import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";
import { validateAndCompute } from "../_shared/coupon.ts";

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
    const { items, customerEmail, userId, environment, couponCode, previousPaymentIntentId } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const env = (environment || "sandbox") as StripeEnv;
    const stripe = createStripeClient(env);

    // Cancel any previous PaymentIntent the client is replacing — prevents
    // an abandoned PI from being confirmed later and creating a duplicate
    // charge for the same cart.
    if (previousPaymentIntentId && typeof previousPaymentIntentId === "string") {
      try {
        await stripe.paymentIntents.cancel(previousPaymentIntentId);
        console.log("Cancelled previous PaymentIntent:", previousPaymentIntentId);
      } catch (e: any) {
        // Ignore — PI may already be confirmed, cancelled, or expired.
        console.log(
          "Could not cancel previous PaymentIntent",
          previousPaymentIntentId,
          "—",
          e?.message,
        );
      }
    }

    // Pre-check: refuse to create a PaymentIntent for cart items that the
    // parent already has an active booking for. Stops the second checkout
    // attempt before money moves, instead of catching it post-charge.
    if (userId) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      for (const item of items) {
        if (!item?.classId) continue;
        const q = supabaseAdmin
          .from("bookings")
          .select("id")
          .eq("class_id", item.classId)
          .eq("parent_id", userId)
          .in("status", ["confirmed", "pending_payment"]);
        if (item.studentId) q.eq("student_id", item.studentId);
        else q.is("student_id", null);
        const { data: existing } = await q.maybeSingle();
        if (existing) {
          return new Response(
            JSON.stringify({
              error: `${item.studentName || "This person"} is already booked into ${item.className || "this class"}. Remove it from your cart to continue.`,
              code: "duplicate_booking",
            }),
            {
              status: 409,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // Compute subtotal
    let subtotalInPence = 0;
    for (const item of items) {
      const amountInPence = Math.round(Number(item.totalPrice || 0) * 100);
      if (amountInPence < 0) {
        throw new Error(`Invalid amount for item: ${item.className}`);
      }
      subtotalInPence += amountInPence;
    }

    // Apply coupon (server-side re-validation)
    let couponId: string | null = null;
    let couponCodeApplied: string | null = null;
    let discountInPence = 0;

    if (couponCode && typeof couponCode === "string" && couponCode.trim().length > 0) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const result = await validateAndCompute(supabase, couponCode, userId, items);
      if ("error" in result) {
        return new Response(JSON.stringify({ error: result.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      couponId = result.couponId;
      couponCodeApplied = result.code;
      discountInPence = Math.round(result.discountAmount * 100);
    }

    const totalAmountInPence = Math.max(0, subtotalInPence - discountInPence);
    if (totalAmountInPence < 30) {
      throw new Error("Total amount is below the £0.30 minimum charge");
    }

    // Compact metadata so we stay under Stripe's 500-char per-value limit.
    const bookingMetadata = Object.fromEntries(
      items.map((item: any, index: number) => [
        `item_${index}`,
        JSON.stringify({
          c: item.classId,
          s: item.studentId || "",
          p: item.pricingPlan,
          t: Number(item.totalPrice || 0),
        }),
      ]),
    );

    const description = items.length === 1
      ? `${items[0].className}${items[0].studentName ? ` — ${items[0].studentName}` : ""}`
      : `${items.length} class bookings`;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmountInPence,
      currency: "gbp",
      automatic_payment_methods: { enabled: true },
      description,
      ...(customerEmail && { receipt_email: customerEmail }),
      metadata: {
        userId: userId || "",
        itemCount: String(items.length),
        checkoutType: "class_booking",
        ...(couponId && {
          couponId,
          couponCode: couponCodeApplied || "",
          discountAmount: String(discountInPence / 100),
        }),
        ...bookingMetadata,
      },
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmountInPence,
        discountAmount: discountInPence / 100,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("PaymentIntent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
