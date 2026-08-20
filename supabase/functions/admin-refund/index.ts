// Admin-only Stripe refund for a booking's card payment. Amie picks any
// booking with a card payment reference and chooses how much to give back
// (partial or full). The refund lands on the parent's card via Stripe;
// the booking's notes record what happened. Membership (subscription)
// payments are refused here — those are per-month invoice refunds.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { connectRequestOptions, createStripeClient } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";

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
    // Caller must be a signed-in admin.
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Not signed in" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) {
      return jsonResponse({ error: "Only admins can issue refunds" }, 403);
    }

    const { bookingId, amountPence, reason } = await req.json();
    if (!bookingId || typeof bookingId !== "string") {
      return jsonResponse({ error: "Missing bookingId" }, 400);
    }
    if (!Number.isInteger(amountPence) || amountPence <= 0) {
      return jsonResponse({ error: "Enter a refund amount greater than zero" }, 400);
    }

    const { data: booking } = await supabase
      .from("bookings")
      .select("id, notes, amount, status, classes(name), students(first_name, last_name)")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return jsonResponse({ error: "Booking not found" }, 404);

    const notes = (booking as any).notes ?? "";
    const piMatch = /pi_[A-Za-z0-9]+/.exec(notes);
    if (!piMatch) {
      if (/sub_[A-Za-z0-9]+/.test(notes)) {
        return jsonResponse({
          error:
            "This booking was paid through a monthly membership subscription. " +
            "Refund the specific month from the Stripe dashboard (Billing → the " +
            "family's invoice) so the right payment is returned.",
          code: "membership_payment",
        }, 400);
      }
      return jsonResponse({
        error: "This booking has no card payment attached (it may have been free or manually added), so there's nothing to refund.",
        code: "no_payment",
      }, 400);
    }
    const paymentIntentId = piMatch[0];

    const env = await getActiveStripeEnv(supabase);
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] },
      connectOpts,
    );
    if (pi.status !== "succeeded") {
      return jsonResponse({ error: "That payment never completed, so there's nothing to refund." }, 400);
    }
    const charge = pi.latest_charge as any;
    const remaining = (charge?.amount ?? 0) - (charge?.amount_refunded ?? 0);
    if (remaining <= 0) {
      return jsonResponse({ error: "This payment has already been fully refunded." }, 400);
    }
    if (amountPence > remaining) {
      return jsonResponse({
        error: `Only £${(remaining / 100).toFixed(2)} of this payment is left to refund. ` +
          "(One card payment can cover several bookings — earlier refunds count against it.)",
        remainingPence: remaining,
      }, 400);
    }

    const refund = await stripe.refunds.create(
      {
        payment_intent: paymentIntentId,
        amount: amountPence,
        metadata: {
          bookingId,
          adminUserId: user.id,
          ...(reason ? { reason: String(reason).slice(0, 200) } : {}),
        },
      },
      connectOpts,
    );

    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("bookings")
      .update({
        notes: `${notes} | refunded £${(amountPence / 100).toFixed(2)} on ${today} (${refund.id})`,
      })
      .eq("id", bookingId);

    console.log(
      "admin-refund:", refund.id, "£" + (amountPence / 100).toFixed(2),
      "booking", bookingId, "by", user.id,
    );
    return jsonResponse({
      success: true,
      refundId: refund.id,
      amountPence,
      remainingPence: remaining - amountPence,
    });
  } catch (error: any) {
    console.error("admin-refund error:", error);
    return jsonResponse({ error: error?.message ?? "Refund failed" }, 500);
  }
});
