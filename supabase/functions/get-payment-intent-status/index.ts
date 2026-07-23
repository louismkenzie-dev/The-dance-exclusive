import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, connectRequestOptions, createStripeClient } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";
import {
  fulfillInvoicePaymentIntent,
  fulfillItems,
  parsePaymentIntentItems,
  recordCouponRedemption,
  sendBookingConfirmationEmail,
} from "../_shared/fulfilment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paymentIntentId } = await req.json();
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid paymentIntentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-authoritative env. A PaymentIntent created just before a mode
    // switch lives in the other environment — both environments are our own
    // accounts, so retrying the lookup there is safe, and fulfilment then
    // uses the environment the PI was actually found in.
    let env: StripeEnv = await getActiveStripeEnv();
    let stripe = createStripeClient(env);
    let pi;
    try {
      pi = await stripe.paymentIntents.retrieve(paymentIntentId, {}, connectRequestOptions(env));
    } catch (e: any) {
      if (e?.code !== "resource_missing" && e?.statusCode !== 404) throw e;
      const other: StripeEnv = env === "live" ? "sandbox" : "live";
      try {
        stripe = createStripeClient(other);
      } catch {
        throw e; // other env not configured — report the original lookup failure
      }
      env = other;
      pi = await stripe.paymentIntents.retrieve(paymentIntentId, {}, connectRequestOptions(env));
    }

    // Fallback: if the webhook hasn't fired (or isn't configured), make sure
    // bookings exist in the DB whenever the PaymentIntent has succeeded.
    // This is idempotent — we check first.
    if (pi.status === "succeeded") {
      try {
        await ensureBookingsForPaymentIntent(pi, stripe, connectRequestOptions(env));
      } catch (e) {
        console.error("ensureBookingsForPaymentIntent failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        status: pi.status,
        amount: pi.amount,
        currency: pi.currency,
        receiptEmail: pi.receipt_email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("get-payment-intent-status error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function ensureBookingsForPaymentIntent(
  pi: any,
  stripe: any,
  connectOpts: Record<string, unknown>,
) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Subscription checkout / renewal — cart metadata lives on the subscription.
  if (pi.invoice) {
    // Skip if this PI's bookings already exist (webhook got there first).
    const { data: existingInvoiceBookings } = await supabase
      .from("bookings")
      .select("id")
      .ilike("notes", `%${pi.id}%`)
      .limit(1);
    if (existingInvoiceBookings && existingInvoiceBookings.length > 0) return;
    await fulfillInvoicePaymentIntent(supabase, stripe, connectOpts, pi);
    return;
  }

  const userId = pi.metadata?.userId;
  if (!userId) {
    console.warn("PI has no userId metadata, skipping booking creation:", pi.id);
    return;
  }

  // Idempotency: if any booking or pass already references this PI, skip.
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .ilike("notes", `%${pi.id}%`)
    .limit(1);
  const { data: existingPass } = await supabase
    .from("class_passes")
    .select("id")
    .eq("payment_intent_id", pi.id)
    .limit(1);
  if ((existing && existing.length > 0) || (existingPass && existingPass.length > 0)) return;

  const items = parsePaymentIntentItems(pi.metadata);
  if (items.length === 0) return;

  const totalAmount = await fulfillItems(supabase, userId, pi, items);

  await recordCouponRedemption(supabase, userId, pi);

  // Send branded confirmation email (mirrors webhook behavior).
  try {
    const charged = pi.amount_received != null ? pi.amount_received / 100 : totalAmount;
    await sendBookingConfirmationEmail(supabase, userId, pi.id, charged || null);
  } catch (e) {
    console.error("Confirmation email send failed:", e);
  }
}
