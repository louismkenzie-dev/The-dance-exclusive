// payments-sync — copy Stripe's statement of money into the payments ledger.
//
// Reads balance transactions on The Dance Exclusive's connected account: the one place the gross,
// Stripe's fee and the Nullshift 1% exist together, and Stripe's own record of what landed. Each
// one becomes a payments row, spread across classes, camps and venues as payment_allocations
// using the rules in _shared/paymentAllocation.ts.
//
// WHAT THIS DOES NOT DO. It never writes to Stripe, and never reads or writes bookings,
// memberships, passes or anything the payment path uses. Fulfilment is payments-webhook's job and
// stays exactly as it was. If this function fails, nobody loses a place; a report is stale.
//
// WHO CAN RUN IT.
//   - The nightly cron (anon bearer, like daily-reminders): incremental only, from the watermark.
//   - A signed-in admin pressing "Sync now": may pass `since` to backfill from a date. With the
//     watermark empty, the first run reads all history — that is the backfill.
// Anyone else gets a 403. A full-history read is the expensive call, so it needs an admin.
//
// IDEMPOTENT. A balance transaction already in the ledger is skipped whole, so a month can be
// re-synced safely and a run that dies half-way is simply repeated.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, connectRequestOptions, createStripeClient } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";
import { parsePaymentIntentItems } from "../_shared/fulfilment.ts";
import {
  type Allocation,
  type AllocationTarget,
  allocate,
  feesFromDetails,
  oneOffTargets,
  paymentKind,
  refundTargets,
  subscriptionTargets,
  withVenues,
} from "../_shared/paymentAllocation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** A generous ceiling for one run. The whole business is a few thousand transactions a year. */
const MAX_PAGES = 200;

const CHARGE_TYPES = new Set(["charge", "payment"]);
const REFUND_TYPES = new Set(["refund", "payment_refund"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---------------------------------------------------------------- who is asking
  let isAdmin = false;
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (bearer) {
    const { data } = await admin.auth.getUser(bearer);
    if (data?.user) {
      const { data: role } = await admin
        .from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
      // A signed-in user who is not an admin has no business here.
      if (!isAdmin) return json({ error: "Only the studio can sync payments." }, 403);
    }
  }
  // The service-role key counts as the studio: it is how Louis runs the first backfill from a
  // terminal, and anyone holding it could read the ledger directly anyway.
  if (!isAdmin && bearer && bearer === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) isAdmin = true;
  const isCron = !isAdmin && bearer === Deno.env.get("SUPABASE_ANON_KEY");
  if (!isAdmin && !isCron) return json({ error: "Not allowed." }, 403);

  let body: { since?: string } = {};
  try { body = await req.json(); } catch { /* cron sends {} or nothing */ }

  // ---------------------------------------------------------------- where to start
  const { data: mark } = await admin
    .from("app_settings").select("value").eq("key", "payments_sync_watermark").maybeSingle();
  const watermark = mark?.value ? Date.parse(mark.value) : NaN;
  // Only an admin may reach back further than the watermark.
  const forced = isAdmin && body.since ? Date.parse(body.since) : NaN;
  const fromMs = Number.isFinite(forced) ? forced : Number.isFinite(watermark) ? watermark : 0;
  const fromUnix = Math.floor(fromMs / 1000);

  const env: StripeEnv = await getActiveStripeEnv(admin);
  const stripe = createStripeClient(env);
  const opts = connectRequestOptions(env);

  // ---------------------------------------------------------------- read Stripe
  // Stripe lists newest first. Collect everything, then process oldest first, so a refund always
  // meets the charge it reverses already in the ledger.
  const txns: any[] = [];
  let startingAfter: string | undefined;
  let pages = 0;
  let complete = true;
  while (true) {
    const page: any = await stripe.balanceTransactions.list(
      {
        limit: 100,
        ...(fromUnix > 0 ? { created: { gte: fromUnix } } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
        expand: ["data.source"],
      },
      opts,
    );
    txns.push(...page.data);
    pages++;
    if (!page.has_more) break;
    if (pages >= MAX_PAGES) { complete = false; break; }
    startingAfter = page.data[page.data.length - 1].id;
  }
  txns.sort((a, b) => a.created - b.created);

  // ---------------------------------------------------------------- lookups, loaded once
  const [{ data: classes }, { data: camps }, { data: memberships }] = await Promise.all([
    admin.from("classes").select("id, venue_id"),
    admin.from("camps").select("id, venue_id"),
    admin.from("memberships").select("user_id, class_id, student_id, stripe_subscription_item_id"),
  ]);
  const classVenue = new Map((classes ?? []).map((c: any) => [c.id, c.venue_id]));
  const campVenue = new Map((camps ?? []).map((c: any) => [c.id, c.venue_id]));
  const membershipRows = (memberships ?? []).map((m: any) => ({
    stripeSubscriptionItemId: m.stripe_subscription_item_id,
    classId: m.class_id,
    studentId: m.student_id,
    userId: m.user_id,
  }));
  const ownerByItem = new Map(membershipRows.map((m) => [m.stripeSubscriptionItemId, m.userId]));

  const summary = { read: txns.length, recorded: 0, alreadyHad: 0, skippedTypes: {} as Record<string, number>, unallocated: 0, mismatched: 0, errors: 0 };

  for (const bt of txns) {
    const isCharge = CHARGE_TYPES.has(bt.type);
    const isRefund = REFUND_TYPES.has(bt.type);
    if (!isCharge && !isRefund) {
      // Payouts, transfers and the like move money that was already counted; they are not revenue.
      summary.skippedTypes[bt.type] = (summary.skippedTypes[bt.type] ?? 0) + 1;
      continue;
    }

    const { data: existing } = await admin
      .from("payments").select("id").eq("balance_transaction_id", bt.id).maybeSingle();
    if (existing) { summary.alreadyHad++; continue; }

    try {
      const grossPence: number = bt.amount;
      const fees = feesFromDetails(bt.fee_details);
      // Stripe's net is the truth. If the itemised fees don't reconcile with it, trust net and put
      // the difference on Stripe's side, and count it so it is visible rather than silent.
      let stripeFeePence = fees.stripeFeePence;
      if (grossPence - stripeFeePence - fees.platformFeePence !== bt.net) {
        summary.mismatched++;
        stripeFeePence = grossPence - fees.platformFeePence - bt.net;
      }
      const amounts = { grossPence, stripeFeePence, platformFeePence: fees.platformFeePence };

      let targets: AllocationTarget[] = [];
      let chargeId: string | null = null;
      let paymentIntentId: string | null = null;
      let invoiceId: string | null = null;
      let parentId: string | null = null;
      let kindOverride: string | null = null;

      if (isCharge) {
        const charge = typeof bt.source === "object" ? bt.source : null;
        chargeId = charge?.id ?? (typeof bt.source === "string" ? bt.source : null);
        paymentIntentId = typeof charge?.payment_intent === "string" ? charge.payment_intent : charge?.payment_intent?.id ?? null;
        invoiceId = typeof charge?.invoice === "string" ? charge.invoice : charge?.invoice?.id ?? null;

        if (invoiceId) {
          const invoice: any = await stripe.invoices.retrieve(invoiceId, {}, opts);
          if (invoice?.metadata?.party_inquiry_id) {
            // Parties hold their venue as free text, so they are filed under head office with no
            // venue rather than guessed at.
            targets = [{ kind: "party", weight: 1 }];
            kindOverride = "party";
          } else {
            const lines: any = await stripe.invoices.listLineItems(invoiceId, { limit: 100 }, opts);
            const lineRefs = (lines?.data ?? []).map((l: any) => ({
              subscriptionItemId: typeof l.subscription_item === "string" ? l.subscription_item : l.subscription_item?.id ?? null,
            }));
            targets = subscriptionTargets(lineRefs, membershipRows);
            parentId = lineRefs.map((l: any) => ownerByItem.get(l.subscriptionItemId)).find(Boolean) ?? null;
          }
        } else if (paymentIntentId) {
          const pi: any = await stripe.paymentIntents.retrieve(paymentIntentId, {}, opts);
          parentId = pi?.metadata?.userId || null;
          // Note: today's hosted merch checkout sets checkoutType on the Checkout Session, not the
          // PaymentIntent, so a payment from it would not be recognised here and would land as
          // "unknown". No merch order has ever been taken; the in-app rewrite puts it on the PI.
          if (pi?.metadata?.checkoutType === "merch") {
            targets = [{ kind: "merch", weight: 1 }];
            kindOverride = "merch";
          } else {
            targets = oneOffTargets(parsePaymentIntentItems(pi?.metadata) as any);
          }
        }
      } else {
        // A refund mirrors the charge it reverses, off the same classes in the same proportions.
        const refund = typeof bt.source === "object" ? bt.source : null;
        chargeId = typeof refund?.charge === "string" ? refund.charge : refund?.charge?.id ?? null;
        paymentIntentId = typeof refund?.payment_intent === "string" ? refund.payment_intent : null;
        if (chargeId) {
          const { data: original } = await admin
            .from("payments")
            .select("id, kind, parent_id, invoice_id, payment_intent_id, payment_allocations(kind, class_id, camp_id, venue_id, student_id, gross_pence, stripe_fee_pence, platform_fee_pence, net_pence)")
            .eq("charge_id", chargeId).eq("type", "charge").maybeSingle();
          if (original) {
            parentId = original.parent_id;
            invoiceId = original.invoice_id;
            paymentIntentId = paymentIntentId ?? original.payment_intent_id;
            kindOverride = original.kind;
            const prior: Allocation[] = ((original as any).payment_allocations ?? []).map((a: any) => ({
              kind: a.kind, classId: a.class_id, campId: a.camp_id, venueId: a.venue_id, studentId: a.student_id,
              grossPence: a.gross_pence, stripeFeePence: a.stripe_fee_pence,
              platformFeePence: a.platform_fee_pence, netPence: a.net_pence,
            }));
            targets = refundTargets(prior);
          }
        }
      }

      targets = withVenues(targets, classVenue, campVenue);
      const allocations = allocate(amounts, targets);
      if (!targets.length) summary.unallocated++;

      const { data: inserted, error: payErr } = await admin
        .from("payments")
        .insert({
          balance_transaction_id: bt.id,
          stripe_env: env,
          type: isRefund ? "refund" : "charge",
          charge_id: chargeId,
          payment_intent_id: paymentIntentId,
          invoice_id: invoiceId,
          kind: kindOverride ?? paymentKind(targets),
          parent_id: parentId,
          gross_pence: amounts.grossPence,
          stripe_fee_pence: amounts.stripeFeePence,
          platform_fee_pence: amounts.platformFeePence,
          net_pence: bt.net,
          currency: bt.currency ?? "gbp",
          occurred_at: new Date(bt.created * 1000).toISOString(),
          description: bt.description ?? null,
        })
        .select("id")
        .single();
      if (payErr) throw payErr;

      const { error: allocErr } = await admin.from("payment_allocations").insert(
        allocations.map((a) => ({
          payment_id: inserted.id,
          kind: a.kind,
          class_id: a.classId,
          camp_id: a.campId,
          venue_id: a.venueId,
          student_id: a.studentId,
          gross_pence: a.grossPence,
          stripe_fee_pence: a.stripeFeePence,
          platform_fee_pence: a.platformFeePence,
          net_pence: a.netPence,
        })),
      );
      if (allocErr) {
        // A payment with no allocations would vanish from every report. Take it back out so the
        // next run tries it again whole.
        await admin.from("payments").delete().eq("id", inserted.id);
        throw allocErr;
      }
      summary.recorded++;
    } catch (e) {
      summary.errors++;
      console.error("payments-sync: could not record", bt.id, e);
    }
  }

  // ---------------------------------------------------------------- advance, only if it is safe
  // Only when every page was read and nothing failed: otherwise the next run starts from the same
  // place and fills the gap, which idempotency makes harmless.
  if (complete && summary.errors === 0 && txns.length) {
    const newest = txns[txns.length - 1].created * 1000;
    await admin.from("app_settings").update({ value: new Date(newest).toISOString() }).eq("key", "payments_sync_watermark");
  }

  return json({ ok: summary.errors === 0, complete, env, from: fromMs ? new Date(fromMs).toISOString() : "the beginning", ...summary });
});
