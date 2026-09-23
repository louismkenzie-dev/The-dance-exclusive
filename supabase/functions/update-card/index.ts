// The card a family's monthly payments come out of.
//
// Amie: "Jodie Cornwell has got a new card and needs to update her card
// details for her.. How do we set her back up?"
//
// There was no way. The only card form in the app is inside checkout, which
// is no help to someone who is already a member, so a parent whose card was
// lost, stolen or replaced had nowhere to put the new one. Jodie's failed on
// 9 September. She was emailed that day. Stripe retried for eleven days,
// gave up, and cancelled both of Eloise's memberships on 20 September —
// £58.14 a month — while Eloise carried on coming to class.
//
// Three actions:
//   status — what card is on file, and whether anything is owed. Read-only,
//            and cheap enough to run whenever the account page opens.
//   start  — a SetupIntent to collect a new card. Created only when the
//            family actually presses the button, never on page load.
//   finish — put the saved card on the customer AND on every live
//            subscription, so it is used for every future month. Only pays
//            the outstanding invoice when explicitly asked to.
//
// NOTHING here charges a card unless payOutstanding is true, and that is a
// separate press with the amount written on it.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { connectRequestOptions, createStripeClient, type StripeEnv } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";
import { type CardSummary, LIVE_MEMBERSHIP_STATUSES, LIVE_SUB_STATUSES } from "../_shared/cardUpdate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cardOf = (pm: any): CardSummary | null => {
  const c = pm?.card;
  if (!c) return null;
  return {
    brand: c.brand ?? null,
    last4: c.last4 ?? null,
    expMonth: c.exp_month ?? null,
    expYear: c.exp_year ?? null,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) return jsonResponse({ error: "Not signed in" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    if (!["status", "start", "finish"].includes(action)) {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    // A family manages their own card. An admin can look at anyone's — Amie
    // needs to see whose card is about to fail — but the card itself is only
    // ever typed in by the family, on their own device.
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = Boolean(adminRole);
    const ownerId: string = typeof body?.userId === "string" && body.userId && isAdmin
      ? body.userId
      : user.id;
    if (action !== "status" && ownerId !== user.id) {
      return jsonResponse({ error: "A card can only be entered by the account holder." }, 403);
    }

    const env: StripeEnv = await getActiveStripeEnv(supabase);
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    // ── The family's memberships, and the Stripe customer behind them ──────
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, status, monthly_amount, stripe_subscription_id, stripe_env, payment_failed_notified_at")
      .eq("user_id", ownerId)
      .in("status", LIVE_MEMBERSHIP_STATUSES);
    const live = (memberships ?? []).filter((m: any) => (m.stripe_env ?? env) === env);
    const subIds = [...new Set(live.map((m: any) => m.stripe_subscription_id).filter(Boolean))] as string[];

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id, full_name, email")
      .eq("user_id", ownerId)
      .maybeSingle();

    // Subscriptions are the truth about which customer is being billed; the
    // profile's id is the fallback, and is verified before it is trusted —
    // an id saved against the other Stripe environment will not resolve.
    const subs: any[] = [];
    for (const id of subIds) {
      try {
        subs.push(await stripe.subscriptions.retrieve(id, { expand: ["latest_invoice"] }, connectOpts));
      } catch (e) {
        console.error("update-card: could not read subscription", id, e);
      }
    }
    const billable = subs.filter((s) => LIVE_SUB_STATUSES.includes(s.status));
    let customerId: string | null = billable
      .map((s) => (typeof s.customer === "string" ? s.customer : s.customer?.id))
      .find(Boolean) ?? null;
    if (!customerId && profile?.stripe_customer_id) {
      try {
        const existing: any = await stripe.customers.retrieve(profile.stripe_customer_id, connectOpts);
        if (!existing?.deleted) customerId = existing.id;
      } catch {
        customerId = null; // belongs to the other environment, or is gone
      }
    }

    // ── What is owed right now, if anything ───────────────────────────────
    let outstanding: { amount: number; invoiceId: string; hostedUrl: string | null; since: string | null } | null = null;
    for (const s of billable) {
      const inv = s.latest_invoice;
      if (!inv || typeof inv === "string") continue;
      if (inv.status !== "open") continue;
      const due = Number(inv.amount_remaining ?? inv.amount_due ?? 0) / 100;
      if (due <= 0) continue;
      outstanding = {
        amount: due,
        invoiceId: inv.id,
        hostedUrl: inv.hosted_invoice_url ?? null,
        since: inv.created ? new Date(inv.created * 1000).toISOString().slice(0, 10) : null,
      };
      break;
    }
    const pastDue = billable.some((s) => s.status === "past_due" || s.status === "unpaid");

    const readCard = async (): Promise<CardSummary | null> => {
      if (!customerId) return null;
      try {
        const customer: any = await stripe.customers.retrieve(
          customerId,
          { expand: ["invoice_settings.default_payment_method"] },
          connectOpts,
        );
        const fromCustomer = cardOf(customer?.invoice_settings?.default_payment_method);
        if (fromCustomer) return fromCustomer;
      } catch (e) {
        console.error("update-card: could not read customer", customerId, e);
      }
      // A subscription can carry its own card that overrides the customer's.
      for (const s of billable) {
        const pm = s.default_payment_method;
        if (!pm) continue;
        try {
          const full: any = typeof pm === "string"
            ? await stripe.paymentMethods.retrieve(pm, {}, connectOpts)
            : pm;
          const card = cardOf(full);
          if (card) return card;
        } catch { /* try the next one */ }
      }
      return null;
    };

    // ── STATUS ────────────────────────────────────────────────────────────
    if (action === "status") {
      return jsonResponse({
        success: true,
        card: await readCard(),
        pastDue,
        outstanding,
        liveMemberships: live.length,
        monthlyTotal: Math.round(live.reduce((sum: number, m: any) => sum + Number(m.monthly_amount || 0), 0) * 100) / 100,
        subscriptions: billable.length,
      });
    }

    // ── START ─────────────────────────────────────────────────────────────
    if (action === "start") {
      if (!customerId) {
        // No customer yet means nothing has ever been billed. Make one so the
        // card has somewhere to live; the memberships attach to it later.
        const created = await stripe.customers.create(
          {
            email: profile?.email || undefined,
            name: profile?.full_name || undefined,
            metadata: { userId: ownerId },
          },
          connectOpts,
        );
        customerId = created.id;
        await supabase.from("profiles").update({ stripe_customer_id: customerId }).eq("user_id", ownerId);
      }
      const intent = await stripe.setupIntents.create(
        {
          customer: customerId,
          usage: "off_session", // it will be charged on the 5th, with nobody watching
          payment_method_types: ["card"],
          metadata: { userId: ownerId, purpose: "update_card" },
        },
        connectOpts,
      );
      if (!intent.client_secret) {
        return jsonResponse({ error: "Stripe didn't return a card form — please try again." }, 502);
      }
      return jsonResponse({ success: true, clientSecret: intent.client_secret, setupIntentId: intent.id });
    }

    // ── FINISH ────────────────────────────────────────────────────────────
    const setupIntentId = typeof body?.setupIntentId === "string" ? body.setupIntentId : "";
    if (!setupIntentId) return jsonResponse({ error: "No card to save" }, 400);

    const seti: any = await stripe.setupIntents.retrieve(
      setupIntentId,
      { expand: ["payment_method"] },
      connectOpts,
    );
    if (!seti || seti.status !== "succeeded") {
      return jsonResponse({ error: "That card wasn't saved — please try again." }, 400);
    }
    const setiCustomer = typeof seti.customer === "string" ? seti.customer : seti.customer?.id;
    // Never let one family's SetupIntent move another family's card.
    if (!setiCustomer || (customerId && setiCustomer !== customerId) || seti.metadata?.userId !== ownerId) {
      return jsonResponse({ error: "That card doesn't belong to this account." }, 403);
    }
    const paymentMethodId = typeof seti.payment_method === "string" ? seti.payment_method : seti.payment_method?.id;
    if (!paymentMethodId) return jsonResponse({ error: "Stripe didn't return the new card — please try again." }, 502);
    const card = cardOf(seti.payment_method);

    // The customer default covers anything billed later; each live
    // subscription is set explicitly, because a subscription's own card wins
    // over the customer's and a stale one there would fail all over again.
    await stripe.customers.update(
      setiCustomer,
      { invoice_settings: { default_payment_method: paymentMethodId } },
      connectOpts,
    );
    let updated = 0;
    const failures: string[] = [];
    for (const s of billable) {
      try {
        await stripe.subscriptions.update(s.id, { default_payment_method: paymentMethodId }, connectOpts);
        updated++;
      } catch (e) {
        console.error("update-card: could not set the card on", s.id, e);
        failures.push(s.id);
      }
    }

    // ── Settling the missed payment, only when asked ──────────────────────
    let paid: { amount: number } | null = null;
    let payError: string | null = null;
    if (body?.payOutstanding === true && outstanding) {
      try {
        const invoice: any = await stripe.invoices.pay(
          outstanding.invoiceId,
          { payment_method: paymentMethodId } as any,
          connectOpts,
        );
        if (invoice?.status === "paid") {
          paid = { amount: Number(invoice.amount_paid ?? 0) / 100 };
          // Stripe puts the subscription back to active itself; our rows are
          // synced here so the family isn't still told they owe money.
          const ids = live.map((m: any) => m.id);
          if (ids.length > 0) {
            await supabase
              .from("memberships")
              .update({ status: "active", payment_failed_notified_at: null, updated_at: new Date().toISOString() })
              .in("id", ids)
              .eq("status", "past_due");
          }
        } else {
          payError = "The payment didn't complete — your new card is saved, and we'll try again automatically.";
        }
      } catch (e: any) {
        console.error("update-card: paying the outstanding invoice failed:", e);
        payError = e?.raw?.message || e?.message
          || "That card was declined for the outstanding payment, but it is saved for next month.";
      }
    }

    return jsonResponse({
      success: true,
      card,
      subscriptionsUpdated: updated,
      subscriptionsFailed: failures.length,
      paid,
      payError,
    });
  } catch (e: any) {
    console.error("update-card error:", e);
    return jsonResponse({ error: e?.message ?? "Something went wrong" }, 500);
  }
});
