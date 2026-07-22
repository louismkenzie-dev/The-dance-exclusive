import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";
import {
  fulfillItems,
  parsePaymentIntentItems,
  recordCouponRedemption,
  sendBookingConfirmationEmail,
} from "../_shared/fulfilment.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

// Legacy embedded Checkout Session flow — kept for any in-flight sessions.
async function handleCheckoutCompleted(session: any) {
  console.log("Checkout completed:", session.id, "payment_status:", session.payment_status);

  if (session.payment_status !== "paid") {
    console.log("Payment not yet paid, skipping booking creation");
    return;
  }

  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("No userId in session metadata");
    return;
  }

  const items = parsePaymentIntentItems(session.metadata);
  if (items.length === 0) {
    console.warn("No parseable items in checkout session metadata:", session.id);
    return;
  }

  const totalAmount = await fulfillItems(supabase, userId, { id: session.id }, items);
  await sendBookingConfirmationEmail(supabase, userId, session.id, totalAmount || null);
}

async function handlePaymentIntentSucceeded(pi: any) {
  console.log("PaymentIntent succeeded:", pi.id);

  const userId = pi.metadata?.userId;
  if (!userId) {
    console.error("No userId in PaymentIntent metadata");
    return;
  }

  await recordCouponRedemption(supabase, userId, pi);

  const items = parsePaymentIntentItems(pi.metadata);
  if (items.length === 0) {
    console.warn("No parseable items in PI metadata:", pi.id);
    return;
  }

  const totalAmount = await fulfillItems(supabase, userId, pi, items);

  // Use the actual amount charged (after discounts) when available
  const charged = pi.amount_received != null ? pi.amount_received / 100 : totalAmount;
  await sendBookingConfirmationEmail(supabase, userId, pi.id, charged || null);
}
