import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

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
    const { paymentIntentId, environment } = await req.json();
    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid paymentIntentId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Fallback: if the webhook hasn't fired (or isn't configured), make sure
    // bookings exist in the DB whenever the PaymentIntent has succeeded.
    // This is idempotent — we check first.
    if (pi.status === "succeeded") {
      try {
        await ensureBookingsForPaymentIntent(pi);
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

async function ensureBookingsForPaymentIntent(pi: any) {
  const userId = pi.metadata?.userId;
  if (!userId) {
    console.warn("PI has no userId metadata, skipping booking creation:", pi.id);
    return;
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Idempotency: if any booking already references this PI, skip.
  const { data: existing } = await supabase
    .from("bookings")
    .select("id")
    .ilike("notes", `%${pi.id}%`)
    .limit(1);
  if (existing && existing.length > 0) return;

  // Reconstruct items from compact metadata.
  const compactItems = Object.entries(pi.metadata || {})
    .filter(([k]) => k.startsWith("item_"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  const cartItems = compactItems
    .map(([, value]) => {
      try { return JSON.parse(String(value)); } catch { return null; }
    })
    .filter((it: any) => it?.c)
    .map((it: any) => ({
      classId: it.c,
      studentId: it.s || null,
      pricingPlan: it.p || "session",
      totalPrice: Number(it.t || 0),
    }));

  if (cartItems.length === 0) return;

  for (const item of cartItems) {
    const { error } = await supabase.from("bookings").insert({
      class_id: item.classId,
      student_id: item.studentId || null,
      parent_id: userId,
      status: "confirmed",
      booking_type: item.pricingPlan || "session",
      amount: item.totalPrice,
      notes: `Stripe PaymentIntent: ${pi.id}`,
    });
    if (error) console.error("Fallback booking insert failed:", error);
  }

  // Record coupon redemption if applicable (also idempotent on payment_intent_id).
  const couponId = pi.metadata?.couponId;
  const discountAmount = Number(pi.metadata?.discountAmount || 0);
  if (couponId) {
    const { data: existingRedemption } = await supabase
      .from("coupon_redemptions")
      .select("id")
      .eq("payment_intent_id", pi.id)
      .limit(1);
    if (!existingRedemption || existingRedemption.length === 0) {
      await supabase.from("coupon_redemptions").insert({
        coupon_id: couponId,
        user_id: userId,
        payment_intent_id: pi.id,
        amount_discounted: discountAmount,
      });
    }
  }

  // Send branded confirmation email (mirrors webhook behavior).
  try {
    const charged = pi.amount_received != null ? pi.amount_received / 100 : null;
    await sendBookingConfirmationEmail(supabase, userId, pi.id, charged);
  } catch (e) {
    console.error("Confirmation email send failed:", e);
  }
}

async function sendBookingConfirmationEmail(
  supabase: any,
  userId: string,
  reference: string,
  totalAmount: number | null,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.email) {
    console.warn("No profile email found, skipping confirmation email:", userId);
    return;
  }

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, booking_type, amount, notes,
       classes:class_id ( name, start_time, end_time, day_of_week,
                          venues:venue_id ( name, city ) ),
       students:student_id ( first_name, last_name )`,
    )
    .ilike("notes", `%${reference}%`);

  if (!bookings || bookings.length === 0) {
    console.warn("No bookings found for reference, skipping email:", reference);
    return;
  }

  const emailPayload = {
    template: "booking_confirmation",
    to: profile.email,
    data: {
      parentName: profile.full_name,
      email: profile.email,
      totalAmount,
      reference,
      bookings: bookings.map((b: any) => ({
        className: b.classes?.name || "Class",
        studentName: b.students
          ? `${b.students.first_name} ${b.students.last_name}`
          : null,
        dayOfWeek: b.classes?.day_of_week || null,
        startTime: b.classes?.start_time || null,
        endTime: b.classes?.end_time || null,
        venueName: b.classes?.venues?.name || null,
        venueCity: b.classes?.venues?.city || null,
        bookingType: b.booking_type,
        amount: b.amount,
      })),
    },
  };

  const { error } = await supabase.functions.invoke("send-email", {
    body: emailPayload,
  });
  if (error) {
    console.error("Failed to send confirmation email:", error);
  } else {
    console.log("Confirmation email sent to:", profile.email);
  }
}
