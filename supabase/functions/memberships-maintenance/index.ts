// Daily membership maintenance (invoked by pg_cron):
//  1. Ends memberships whose one-month notice period is up — removes the
//     subscription item (or lets Stripe's own cancel_at finish the job when
//     the whole subscription is ending), marks them cancelled and emails the
//     family.
//  2. Syncs membership statuses/periods with Stripe (past-due, cancelled).
//  3. Pauses collection for August (no payments over the summer break) and
//     resumes it for September, per the club's 38-dance-week pricing.
// All operations are idempotent — running it repeatedly is safe.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";

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

  const summary = { endedNow: 0, syncedCancelled: 0, pastDue: 0, paused: 0, resumed: 0, errors: 0 };
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
    const { data: openMemberships } = await supabase
      .from("memberships")
      .select("*")
      .eq("stripe_env", env)
      .in("status", ["active", "past_due", "paused", "cancel_scheduled"]);
    const bySub = new Map<string, any[]>();
    for (const m of openMemberships ?? []) {
      const list = bySub.get(m.stripe_subscription_id) ?? [];
      list.push(m);
      bySub.set(m.stripe_subscription_id, list);
    }

    const month = new Date().getUTCMonth(); // 7 = August, 8 = September
    const year = new Date().getUTCFullYear();

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

        // ── 3. Summer pause: no collection in August, resume in September ──
        if (month === 7 && !sub.pause_collection && sub.status === "active") {
          const resumesAt = Math.floor(Date.UTC(year, 8, 1) / 1000); // 1 Sept
          await stripe.subscriptions.update(
            subId,
            { pause_collection: { behavior: "void", resumes_at: resumesAt } },
            connectOpts,
          );
          await supabase
            .from("memberships")
            .update({ status: "paused", updated_at: nowIso })
            .eq("stripe_subscription_id", subId)
            .eq("status", "active");
          summary.paused++;
        } else if (month !== 7 && sub.pause_collection) {
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
  }

  console.log("memberships-maintenance:", JSON.stringify(summary));
  return jsonResponse({ success: true, ...summary });
});
