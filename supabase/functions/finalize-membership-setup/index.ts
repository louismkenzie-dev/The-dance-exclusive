// Finalises an August card-setup membership signup (nothing charged today):
// called by checkout once Stripe reports the SetupIntent succeeded, and by
// CheckoutReturn after a redirect flow. Verifies the caller owns the
// subscription's membership rows, makes the saved card the subscription's
// default payment method, then runs the shared idempotent activation
// (bookings + incomplete→active + confirmation email). Safe to call
// repeatedly — the daily maintenance job uses the same gate as a fallback.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { activateMembershipSetup } from "../_shared/fulfilment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "You must be signed in to finish setting up a membership" }, 401);
    }

    const { subscriptionId } = await req.json();
    if (!subscriptionId || typeof subscriptionId !== "string") {
      return jsonResponse({ error: "No subscription provided" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: rows } = await supabase
      .from("memberships")
      .select("user_id, stripe_env, stripe_setup_intent_id")
      .eq("stripe_subscription_id", subscriptionId);
    if (!rows || rows.length === 0 || rows.some((r: any) => r.user_id !== user.id)) {
      return jsonResponse({ error: "Membership not found" }, 403);
    }

    // The membership rows record which Stripe environment their subscription
    // lives in — always use that, never a client-supplied value.
    const env: StripeEnv = rows[0].stripe_env === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    let sub: any = null;
    try {
      sub = await stripe.subscriptions.retrieve(
        subscriptionId,
        { expand: ["pending_setup_intent", "default_payment_method"] },
        connectOpts,
      );
    } catch (e) {
      console.error("Could not retrieve subscription:", subscriptionId, e);
    }
    if (!sub) return jsonResponse({ error: "Subscription not found" }, 404);

    // The SetupIntent id was recorded at checkout; Stripe clears
    // pending_setup_intent once it succeeds, so the stored id comes first.
    const setupIntentId = rows[0].stripe_setup_intent_id ??
      (typeof sub.pending_setup_intent === "string"
        ? sub.pending_setup_intent
        : sub.pending_setup_intent?.id) ?? null;
    if (!setupIntentId) {
      return jsonResponse({ error: "No card setup found for this membership" }, 404);
    }

    const seti: any = await stripe.setupIntents.retrieve(setupIntentId, {}, connectOpts);
    if (seti?.status !== "succeeded") {
      // Card save hasn't completed yet (or failed) — nothing to activate.
      return jsonResponse({ pending: true });
    }

    // Make the saved card the subscription's default so the first payment on
    // the 5th (and every renewal after) has something to bill.
    if (!sub.default_payment_method && seti.payment_method) {
      const paymentMethodId = typeof seti.payment_method === "string"
        ? seti.payment_method
        : seti.payment_method.id;
      await stripe.subscriptions.update(
        sub.id,
        { default_payment_method: paymentMethodId },
        connectOpts,
      );
    }

    // Idempotent: only acts while the sub still has 'incomplete' rows, so a
    // client retry, the redirect path and the maintenance fallback can't
    // double-book or re-send the confirmation email.
    const activated = await activateMembershipSetup(supabase, sub);

    return jsonResponse({
      success: true,
      activated,
      firstPaymentDate: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    });
  } catch (error: any) {
    console.error("finalize-membership-setup error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
