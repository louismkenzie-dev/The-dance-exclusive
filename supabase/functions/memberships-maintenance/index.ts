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
import {
  activateMembershipSetup,
  ensureMembershipRows,
  parsePaymentIntentItems,
} from "../_shared/fulfilment.ts";
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
    cancelledDuplicates: 0,
    adopted: 0,
    adjustmentsApplied: 0,
    errors: 0,
  };
  const nowIso = new Date().toISOString();

  // Operational notices go to the studio owner.
  const notifyOwner = async (data: Record<string, unknown>) => {
    try {
      const { data: owners } = await supabase
        .from("staff")
        .select("email")
        .eq("role", "ceo_owner")
        .eq("is_active", true)
        .not("email", "is", null);
      for (const o of owners ?? []) {
        await supabase.functions.invoke("send-email", {
          headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
          body: { template: "internal_notice", to: o.email, data },
        });
      }
    } catch (e) {
      console.error("Owner notice failed:", e);
    }
  };

  const describeFamily = async (userId: string) => {
    const { data: p } = await supabase.from("profiles").select("full_name, email").eq("user_id", userId).maybeSingle();
    return p?.full_name ? `${p.full_name}${p.email ? ` (${p.email})` : ""}` : userId;
  };

  const describeItems = async (items: { classId: string | null; studentId: string | null; totalPrice: number }[]) => {
    const out: string[] = [];
    for (const i of items) {
      const [{ data: cls }, { data: st }] = await Promise.all([
        i.classId ? supabase.from("classes").select("name").eq("id", i.classId).maybeSingle() : Promise.resolve({ data: null }),
        i.studentId ? supabase.from("students").select("first_name, last_name").eq("id", i.studentId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      out.push(`${cls?.name ?? "Class"}${st ? ` — ${st.first_name} ${st.last_name}` : ""} · £${Number(i.totalPrice).toFixed(2)}/month`);
    }
    return out;
  };

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
        await sendEmail(m.user_id, "membership_ended", { ...desc, endDate: m.cancel_at, scheduled: true });
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
            // Ended in Stripe rather than through our notice period, so the
            // membership stopped today — cancel_at may be a date still in the
            // future, which would read as an end date that hasn't happened.
            await sendEmail(m.user_id, "membership_ended", { ...desc, endDate: nowIso });
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

        // ── 5. One-month payment adjustments ────────────────────────────────
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
          // Every place on this subscription failed on the same payment, so
          // the family gets ONE email covering all of them — sending one per
          // membership meant a parent with five children's places received
          // five identical "payment failed" emails within seconds.
          const nowFailing = members.filter((x: any) => x.status === "active");
          const described: any[] = [];
          for (const m of nowFailing) {
            await supabase
              .from("memberships")
              .update({ status: "past_due", updated_at: nowIso })
              .eq("id", m.id);
            summary.pastDue++;
            described.push({ m, desc: await describeMembership(m) });
          }
          if (described.length > 0) {
            const first = described[0];
            await sendEmail(first.m.user_id, "membership_payment_failed", {
              ...first.desc,
              monthlyAmount: Number(first.m.monthly_amount),
              items: described.map(({ m, desc }) => ({
                className: desc.className,
                studentName: desc.studentName,
                monthlyAmount: Number(m.monthly_amount),
              })),
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
    // subscription from the earlier attempt never appears in the grouping
    // above. Every live membership-checkout subscription with no rows is
    // one of three things:
    //   - a duplicate: the family already holds a live membership for the
    //     same class and dancer on another subscription → cancel it, and if
    //     it has taken money tell the studio so it can be refunded;
    //   - a real signup our records lost (paid, or card saved) → adopt it by
    //     repairing the rows, so it is managed and billed like any other;
    //   - an abandoned card-less checkout older than 24h → cancel quietly.
    try {
      const orphans: any[] = [];
      for (const status of ["trialing", "active", "past_due"]) {
        let starting_after: string | undefined;
        for (let page = 0; page < 10; page++) {
          const res: any = await stripe.subscriptions.list(
            { status, limit: 100, ...(starting_after ? { starting_after } : {}) } as any,
            connectOpts,
          );
          for (const s of res?.data ?? []) {
            if (bySub.has(s.id)) continue; // handled with its DB rows above
            if (s.metadata?.checkoutType !== "membership_checkout") continue;
            orphans.push(s);
          }
          if (!res?.has_more || !res.data?.length) break;
          starting_after = res.data[res.data.length - 1].id;
        }
      }

      for (const orphan of orphans) {
        try {
          const userId = orphan.metadata?.userId as string | undefined;
          const items = parsePaymentIntentItems(orphan.metadata).filter(
            (i) => i.kind === "class" && i.pricingPlan === "monthly" && i.classId,
          );
          const { data: paidInvoices } = await stripe.invoices.list(
            { subscription: orphan.id, status: "paid", limit: 10 },
            connectOpts,
          );
          const paidPence = (paidInvoices ?? []).reduce((n: number, inv: any) => n + (inv.amount_paid ?? 0), 0);

          // Already covered on another live subscription?
          let duplicateOf: string | null = null;
          if (userId && items.length > 0) {
            const { data: liveRows } = await supabase
              .from("memberships")
              .select("class_id, student_id, stripe_subscription_id")
              .eq("user_id", userId)
              .eq("stripe_env", env)
              .in("status", ["active", "past_due", "paused", "cancel_scheduled"])
              .neq("stripe_subscription_id", orphan.id);
            const hit = (liveRows ?? []).find((r: any) =>
              items.some((i) => i.classId === r.class_id && (i.studentId ?? "") === (r.student_id ?? "")),
            );
            duplicateOf = hit?.stripe_subscription_id ?? null;
          }

          if (duplicateOf) {
            await stripe.subscriptions.cancel(orphan.id, { prorate: false, invoice_now: false } as any, connectOpts);
            summary.cancelledDuplicates++;
            console.log("Cancelled duplicate subscription", orphan.id, "(family already on", duplicateOf + ")");
            if (paidPence > 0) {
              const who = await describeFamily(userId!);
              await notifyOwner({
                title: "Duplicate membership charged — refund needed",
                intro: `${who} was billed on a duplicate membership subscription that our records didn't hold. It has been cancelled so it can't bill again, but the money it took needs refunding from Stripe.`,
                rows: [
                  { label: "Family", value: who },
                  { label: "Taken", value: `£${(paidPence / 100).toFixed(2)}` },
                  { label: "Duplicate subscription", value: orphan.id },
                  { label: "Their real subscription", value: duplicateOf },
                ],
                listTitle: "Classes on the duplicate",
                list: await describeItems(items),
                ctaLabel: "Open Stripe payments",
                ctaUrl: "https://dashboard.stripe.com/payments",
                urgent: true,
              });
            }
            continue;
          }

          if (paidPence > 0 || orphan.default_payment_method) {
            // A real signup whose rows were lost: bring it back under management.
            const repaired = await ensureMembershipRows(supabase, orphan, env);
            if (await activateMembershipSetup(supabase, orphan, { quiet: true, env })) summary.activatedSetups++;
            if (repaired > 0) {
              summary.adopted++;
              console.log("Adopted untracked subscription", orphan.id, "— rows repaired:", repaired);
            }
            continue;
          }

          if (orphan.status === "trialing" && orphan.created && orphan.created * 1000 < Date.now() - 24 * 3600_000) {
            await stripe.subscriptions.cancel(orphan.id, {}, connectOpts);
            summary.cancelledAbandoned++;
            console.log("Cancelled orphaned trialing subscription:", orphan.id);
          }
        } catch (e) {
          summary.errors++;
          console.error("Orphan handling failed for", orphan.id, e);
        }
      }
    } catch (e) {
      console.error("Orphan sweep failed for", env, e);
    }
  }

  console.log("memberships-maintenance:", JSON.stringify(summary));
  return jsonResponse({ success: true, ...summary });
});
