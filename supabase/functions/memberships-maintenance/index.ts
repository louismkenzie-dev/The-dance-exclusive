// Daily membership maintenance (invoked by pg_cron):
//  1. Ends memberships whose one-month notice period is up — removes the
//     subscription item (or lets Stripe's own cancel_at finish the job when
//     the whole subscription is ending), marks them cancelled and emails the
//     family.
//  2. Syncs membership statuses/periods with Stripe (past-due, cancelled).
//  3. Pauses collection across each subscription's annual FREE MONTH
//     (memberships.free_month — the 12th month families don't pay) and
//     resumes it the month after.
//  4. Handles trial-anchored signups (August card-setup checkouts): activates
//     memberships once a card is on file if the client-side finalize never
//     ran, and cancels abandoned card-less checkouts after 24h — including
//     orphaned Stripe subscriptions whose DB rows a re-checkout deleted.
//  5. Passes pending one-month payment adjustments ("£7 off February") to
//     Stripe as invoice items once that month's payment is the next one due,
//     so they land on that month's invoice.
// All operations are idempotent — running it repeatedly is safe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { londonYMD, resumeAfterFreeMonth } from "../_shared/billing.ts";
import { activateMembershipSetup } from "../_shared/fulfilment.ts";
import {
  ensureAdjustmentInvoiceItem,
  markAdjustmentApplied,
  retirePendingAdjustments,
  yearMonth,
} from "../_shared/membershipAdjustments.ts";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary = {
    endedNow: 0,
    syncedCancelled: 0,
    pastDue: 0,
    paused: 0,
    resumed: 0,
    activatedSetups: 0,
    cancelledAbandoned: 0,
    adjustmentsApplied: 0,
    errors: 0,
  };
  const nowIso = new Date().toISOString();

  const sendEmail = async (userId: string, template: string, data: Record<string, unknown>) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (!profile?.email) return;
      await supabase.functions.invoke("send-email", {
        headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
        body: { template, to: profile.email, data: { parentName: profile.full_name, ...data } },
      });
    } catch (e) {
      console.error("Maintenance email failed:", e);
    }
  };

  // When a membership actually ends, take the standing weekly booking off the
  // register too — otherwise lapsed families keep appearing at the door.
  const retireBooking = async (m: any) => {
    // A membership that has ended can't receive a payment adjustment either.
    await retirePendingAdjustments(supabase, m.id, null, "membership ended before this payment");
    if (!m.class_id) return;
    let q = supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("parent_id", m.user_id)
      .eq("class_id", m.class_id)
      .eq("status", "confirmed")
      .eq("booking_type", "monthly");
    q = m.student_id ? q.eq("student_id", m.student_id) : q.is("student_id", null);
    const { error } = await q;
    if (error) console.error("Failed to retire booking for membership", m.id, error);
  };

  const describeMembership = async (m: any) => {
    const [{ data: student }, { data: cls }] = await Promise.all([
      m.student_id
        ? supabase.from("students").select("first_name, last_name").eq("id", m.student_id).maybeSingle()
        : Promise.resolve({ data: null }),
      m.class_id
        ? supabase.from("classes").select("name").eq("id", m.class_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      studentName: student ? `${student.first_name} ${student.last_name}` : null,
      className: cls?.name ?? "your class",
    };
  };

  for (const env of ["sandbox", "live"] as StripeEnv[]) {
    let stripe;
    try {
      stripe = createStripeClient(env);
    } catch {
      continue; // this environment isn't configured
    }
    const connectOpts = connectRequestOptions(env);

    // ── 1. End memberships whose notice period is complete ──────────────
    const { data: due } = await supabase
      .from("memberships")
      .select("*")
      .eq("stripe_env", env)
      .eq("status", "cancel_scheduled")
      .lte("cancel_at", nowIso);
    for (const m of due ?? []) {
      try {
        let sub: any = null;
        try {
          sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, connectOpts);
        } catch {
          sub = null; // already gone in Stripe
        }
        if (sub && sub.status !== "canceled") {
          const activeItems = sub.items?.data ?? [];
          if (m.stripe_subscription_item_id && activeItems.length > 1) {
            // Remove just this membership's item; the rest of the family
            // keeps billing as normal.
            await stripe.subscriptionItems.del(
              m.stripe_subscription_item_id,
              { proration_behavior: "none" },
              connectOpts,
            );
          } else {
            await stripe.subscriptions.cancel(m.stripe_subscription_id, {}, connectOpts);
          }
        }
        await supabase
          .from("memberships")
          .update({ status: "cancelled", cancelled_at: nowIso, updated_at: nowIso })
          .eq("id", m.id);
        await retireBooking(m);
        summary.endedNow++;
        const desc = await describeMembership(m);
        await sendEmail(m.user_id, "membership_ended", { ...desc, endDate: m.cancel_at });
      } catch (e) {
        summary.errors++;
        console.error("Failed to end membership", m.id, e);
      }
    }

    // ── 2. Sync live statuses with Stripe ───────────────────────────────
    // 'incomplete' rows (free_month included via *) are needed so trialing
    // card-setup subscriptions can be activated or abandoned below.
    const { data: openMemberships } = await supabase
      .from("memberships")
      .select("*")
      .eq("stripe_env", env)
      .in("status", ["active", "past_due", "paused", "cancel_scheduled", "incomplete"]);
    const bySub = new Map<string, any[]>();
    for (const m of openMemberships ?? []) {
      const list = bySub.get(m.stripe_subscription_id) ?? [];
      list.push(m);
      bySub.set(m.stripe_subscription_id, list);
    }

    const month = londonYMD().m; // 1-based London calendar month (8 = August)

    for (const [subId, members] of bySub) {
      try {
        let sub: any = null;
        try {
          sub = await stripe.subscriptions.retrieve(subId, {}, connectOpts);
        } catch {
          sub = null;
        }

        if (!sub || sub.status === "canceled") {
          for (const m of members) {
            await supabase
              .from("memberships")
              .update({ status: "cancelled", cancelled_at: m.cancelled_at ?? nowIso, updated_at: nowIso })
              .eq("id", m.id)
              .neq("status", "cancelled");
            await retireBooking(m);
            summary.syncedCancelled++;
            // Never-activated checkouts get no "membership ended" email.
            if (m.status === "incomplete") continue;
            const desc = await describeMembership(m);
            await sendEmail(m.user_id, "membership_ended", { ...desc, endDate: m.cancel_at ?? nowIso });
          }
          continue;
        }

        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await supabase
          .from("memberships")
          .update({ current_period_end: periodEnd, updated_at: nowIso })
          .eq("stripe_subscription_id", subId)
          .in("status", ["active", "past_due", "paused", "cancel_scheduled"]);

        // ── 5. One-month payment adjustments ────────────────────────────
        // A pending "£x off <month>" is handed to Stripe as an invoice item
        // once that month's payment is the next one due (invoices are raised
        // on the 5th at 07:00 UTC; this runs at 06:10, so an item created
        // any day up to then lands on the right invoice).
        if (periodEnd) {
          const chargeYm = yearMonth(new Date(periodEnd));
          // Memberships that are ending take one last payment; adjustments
          // beyond it would never be invoiced, so retire them instead.
          for (const m of members) {
            if (m.status === "cancel_scheduled" && m.final_payment_date) {
              await retirePendingAdjustments(
                supabase, m.id, yearMonth(new Date(m.final_payment_date)),
                "membership ends before this payment",
              );
            }
          }
          const { data: pendingAdjustments } = await supabase
            .from("membership_adjustments")
            .select("*")
            .in("membership_id", members.map((m: any) => m.id))
            .eq("status", "pending");
          const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
          for (const adj of pendingAdjustments ?? []) {
            if (String(adj.billing_month).slice(0, 7) !== chargeYm || !customerId) continue;
            try {
              // Finds an item already created for this adjustment (a lost
              // reply earlier) before creating one, so re-runs never double up.
              const invoiceItem = await ensureAdjustmentInvoiceItem(stripe, connectOpts, customerId, subId, adj);
              if (await markAdjustmentApplied(supabase, adj.id, invoiceItem.id)) summary.adjustmentsApplied++;
              else summary.errors++;
            } catch (e) {
              summary.errors++;
              console.error("Failed to apply membership adjustment", adj.id, e);
            }
          }
        }

        if (sub.status === "past_due" || sub.status === "unpaid") {
          // Stripe's hosted invoice page lets the family pay the failed month
          // (with a different card if needed) — the "Pay Now" in our email.
          let payUrl: string | null = null;
          try {
            if (sub.latest_invoice) {
              const invoiceId = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice.id;
              const invoice: any = await stripe.invoices.retrieve(invoiceId, {}, connectOpts);
              if (invoice?.status === "open") payUrl = invoice.hosted_invoice_url ?? null;
            }
          } catch (e) {
            console.error("Could not fetch hosted invoice for", subId, e);
          }
          for (const m of members.filter((x: any) => x.status === "active")) {
            await supabase
              .from("memberships")
              .update({ status: "past_due", updated_at: nowIso })
              .eq("id", m.id);
            summary.pastDue++;
            const desc = await describeMembership(m);
            await sendEmail(m.user_id, "membership_payment_failed", {
              ...desc,
              monthlyAmount: Number(m.monthly_amount),
              payUrl,
            });
          }
        }

        // ── 3. Annual free month + trial-anchored signups ──────────────────
        // Each subscription skips its own free month (memberships.free_month,
        // shared by every row on the sub) via pause_collection "void" across
        // that month, then resumes. Existing rows default to August.
        const freeMonth = members.find((x: any) => x.free_month != null)?.free_month ?? 8;

        if (sub.status === "trialing") {
          // Trialing subs are never paused — the trial already covers the gap.
          if (sub.default_payment_method && members.some((x: any) => x.status === "incomplete")) {
            // Card saved but the client-side finalize never ran — activate now.
            if (await activateMembershipSetup(supabase, sub)) summary.activatedSetups++;
          } else if (
            !sub.default_payment_method &&
            sub.created &&
            sub.created * 1000 < Date.now() - 24 * 3600_000
          ) {
            // Abandoned August checkout: still no card 24h on — clean up
            // quietly (no email; nothing ever started).
            await stripe.subscriptions.cancel(subId, {}, connectOpts);
            await supabase
              .from("memberships")
              .update({ status: "cancelled", cancelled_at: nowIso, updated_at: nowIso })
              .eq("stripe_subscription_id", subId)
              .neq("status", "cancelled");
            summary.cancelledAbandoned++;
          }
        } else if (sub.status === "active" && !sub.pause_collection && month === freeMonth) {
          await stripe.subscriptions.update(
            subId,
            {
              pause_collection: {
                behavior: "void",
                resumes_at: Math.floor(resumeAfterFreeMonth(freeMonth).getTime() / 1000),
              },
            },
            connectOpts,
          );
          await supabase
            .from("memberships")
            .update({ status: "paused", updated_at: nowIso })
            .eq("stripe_subscription_id", subId)
            .eq("status", "active");
          summary.paused++;
        } else if (sub.pause_collection && month !== freeMonth) {
          await stripe.subscriptions.update(subId, { pause_collection: "" } as any, connectOpts);
          await supabase
            .from("memberships")
            .update({ status: "active", updated_at: nowIso })
            .eq("stripe_subscription_id", subId)
            .eq("status", "paused");
          summary.resumed++;
        }
      } catch (e) {
        summary.errors++;
        console.error("Failed to sync subscription", subId, e);
      }
    }

    // ── 4. Orphan sweep ─────────────────────────────────────────────────
    // A re-checkout deletes a user's 'incomplete' membership rows, so the
    // abandoned subscription from the earlier attempt never appears in the
    // grouping above. Cancel any card-less membership-checkout trial older
    // than 24h so it can't start billing when the trial ends.
    try {
      const trialing: any = await stripe.subscriptions.list(
        { status: "trialing", limit: 100 },
        connectOpts,
      );
      for (const orphan of trialing?.data ?? []) {
        if (bySub.has(orphan.id)) continue; // handled with its DB rows above
        if (orphan.metadata?.checkoutType !== "membership_checkout") continue;
        if (orphan.default_payment_method) continue;
        if (!orphan.created || orphan.created * 1000 >= Date.now() - 24 * 3600_000) continue;
        try {
          await stripe.subscriptions.cancel(orphan.id, {}, connectOpts);
          summary.cancelledAbandoned++;
          console.log("Cancelled orphaned trialing subscription:", orphan.id);
        } catch (e) {
          console.error("Failed to cancel orphaned subscription", orphan.id, e);
        }
      }
    } catch (e) {
      console.error("Orphan sweep failed for", env, e);
    }
  }

  console.log("memberships-maintenance:", JSON.stringify(summary));
  return jsonResponse({ success: true, ...summary });
});
