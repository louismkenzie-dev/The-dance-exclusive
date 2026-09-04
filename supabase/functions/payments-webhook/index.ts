import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
  verifyWebhook,
} from "../_shared/stripe.ts";
import {
  fulfillInvoicePaymentIntent,
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
        await handlePaymentIntentSucceeded(event.data.object, env);
        break;
      case "invoice.paid":
        await handlePartyInvoicePaid(event.data.object);
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

// Party deposit/balance invoices carry their enquiry in metadata. Membership
// renewal invoices don't, and are fulfilled through the PaymentIntent path.
async function handlePartyInvoicePaid(invoice: any) {
  const inquiryId = invoice?.metadata?.party_inquiry_id;
  if (!inquiryId) return;

  const { data: payment, error } = await supabase
    .from("party_payments")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("stripe_invoice_id", invoice.id)
    .select("kind")
    .maybeSingle();
  if (error) {
    console.error("party invoice paid update failed:", error);
    return;
  }
  if (!payment) {
    console.warn("Paid party invoice has no matching record:", invoice.id);
    return;
  }

  // A paid deposit is what actually secures the date.
  if (payment.kind === "deposit") {
    await supabase
      .from("party_inquiries")
      .update({ status: "confirmed" })
      .eq("id", inquiryId)
      .neq("status", "confirmed");
  }
  console.log("Party invoice paid:", invoice.id, payment.kind);
}

/**
 * A paid uniform / merchandise order: mark the order paid, take the stock and
 * send the customer their receipt. Idempotent — complete_merch_order only acts
 * on an order that hasn't been fulfilled yet, so a replayed webhook is a no-op.
 */
async function handleMerchCheckoutCompleted(session: any) {
  const orderId = session.metadata?.merchOrderId;
  if (!orderId) {
    console.warn("Merch checkout session without an order id:", session.id);
    return;
  }

  const details = session.customer_details ?? {};
  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  // Stripe's checkout page is where a guest actually types their name, email
  // and phone — fill in anything we didn't already know.
  const contact: Record<string, string> = {};
  if (details.name) contact.customer_name = details.name;
  if (details.email) contact.customer_email = details.email;
  if (details.phone) contact.customer_phone = details.phone;
  if (Object.keys(contact).length > 0) {
    await supabase.from("merchandise_orders").update(contact).eq("id", orderId);
  }

  const { data: fulfilled, error } = await supabase.rpc("complete_merch_order", {
    _order_id: orderId,
    _payment_intent_id: paymentIntentId,
  });
  if (error) {
    console.error("complete_merch_order failed:", error);
    return;
  }
  if (!fulfilled) {
    console.log("Merch order already fulfilled or unknown:", orderId);
    return;
  }

  const [{ data: order }, { data: lines }] = await Promise.all([
    supabase
      .from("merchandise_orders")
      .select("id, customer_name, customer_email, total_amount")
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("merchandise_order_items")
      .select("product_name, size, quantity, unit_price")
      .eq("order_id", orderId),
  ]);

  if (!order?.customer_email) {
    console.warn("Merch order has no email — receipt not sent:", orderId);
    return;
  }

  const { error: emailError } = await supabase.functions.invoke("send-email", {
    headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
    body: {
      template: "merch_order_confirmation",
      to: order.customer_email,
      data: {
        customerName: order.customer_name,
        orderReference: order.id,
        totalAmount: Number(order.total_amount ?? 0),
        items: (lines ?? []).map((l: any) => ({
          productName: l.product_name,
          size: l.size,
          quantity: l.quantity,
          unitPrice: Number(l.unit_price ?? 0),
        })),
      },
    },
  });
  if (emailError) console.error("Merch receipt email failed:", emailError);
}

// Legacy embedded Checkout Session flow — kept for any in-flight sessions.
async function handleCheckoutCompleted(session: any) {
  console.log("Checkout completed:", session.id, "payment_status:", session.payment_status);

  if (session.payment_status !== "paid") {
    console.log("Payment not yet paid, skipping booking creation");
    return;
  }

  if (session.metadata?.checkoutType === "merch") {
    await handleMerchCheckoutCompleted(session);
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

async function handlePaymentIntentSucceeded(pi: any, env: StripeEnv) {
  console.log("PaymentIntent succeeded:", pi.id);

  // Subscription checkouts and renewals pay via an INVOICE PaymentIntent —
  // the cart metadata lives on the subscription, not the PI. Webhook events
  // built with Stripe's 2025 "Basil" API omit `pi.invoice`, so when it's
  // missing AND the PI carries no cart metadata, re-retrieve it under our
  // pinned pre-Basil version to recover the invoice link.
  let invoicePi = pi.invoice ? pi : null;
  if (!invoicePi && !pi.metadata?.userId) {
    try {
      const stripe = createStripeClient(env);
      const retrieved = await stripe.paymentIntents.retrieve(pi.id, {}, connectRequestOptions(env));
      if ((retrieved as any).invoice) invoicePi = retrieved;
    } catch (e) {
      console.error("PI re-retrieve failed:", e);
    }
  }
  if (invoicePi) {
    try {
      const stripe = createStripeClient(env);
      await fulfillInvoicePaymentIntent(supabase, stripe, connectRequestOptions(env), invoicePi);
    } catch (e) {
      console.error("Invoice PI fulfilment failed:", e);
    }
    return;
  }

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
