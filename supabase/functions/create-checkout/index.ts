import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  type StripeEnv,
  bookingApplicationFee,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items, customerEmail, userId, returnUrl } = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "No items provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-authoritative: the request no longer chooses sandbox vs live.
    const env: StripeEnv = await getActiveStripeEnv();
    const stripe = createStripeClient(env);

    // Validate return URL — must be absolute https/http URL.
    // Sandboxed iframes may send origin as "null" or relative paths.
    const isValidReturnUrl = (u: unknown): u is string => {
      if (typeof u !== "string" || !u) return false;
      try {
        const parsed = new URL(u);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    };

    const originHeader = req.headers.get("origin");
    const refererHeader = req.headers.get("referer");
    let safeOrigin: string | null = null;
    if (isValidReturnUrl(originHeader)) safeOrigin = originHeader!;
    else if (refererHeader) {
      try { safeOrigin = new URL(refererHeader).origin; } catch { /* ignore */ }
    }

    let finalReturnUrl: string;
    if (isValidReturnUrl(returnUrl)) {
      finalReturnUrl = returnUrl;
    } else if (safeOrigin) {
      finalReturnUrl = `${safeOrigin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`;
    } else {
      return new Response(JSON.stringify({
        error: "Could not determine a valid return URL. Please reload the page and try again.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build line items from cart items using price_data for dynamic pricing
    const lineItems = items.map((item: any) => {
      const amountInPence = Math.round(item.totalPrice * 100);
      if (amountInPence < 30) {
        throw new Error(`Amount too low for item: ${item.className}`);
      }

      const description = [
        item.studentName ? `Student: ${item.studentName}` : null,
        item.dayOfWeek ? `${item.dayOfWeek.charAt(0).toUpperCase() + item.dayOfWeek.slice(1)}` : null,
        item.startTime && item.endTime ? `${item.startTime.slice(0, 5)}–${item.endTime.slice(0, 5)}` : null,
        item.venueName || null,
        item.pricingPlan ? `Plan: ${item.pricingPlan}` : null,
      ].filter(Boolean).join(" · ");

      return {
        price_data: {
          currency: "gbp",
          product_data: {
            name: item.className,
            description,
            metadata: {
              classId: item.classId,
              studentId: item.studentId || "",
              pricingPlan: item.pricingPlan,
            },
          },
          unit_amount: amountInPence,
        },
        quantity: 1,
      };
    });

    const bookingMetadata = Object.fromEntries(
      items.map((item: any, index: number) => [
        `item_${index}`,
        JSON.stringify({
          c: item.classId,
          s: item.studentId || "",
          p: item.pricingPlan,
          t: Number(item.totalPrice || 0),
        }),
      ])
    );

    // Nullshift platform fee (1% of booking revenue) on the direct charge —
    // only when Connect is configured for this environment.
    const totalInPence = lineItems.reduce(
      (sum: number, li: any) => sum + li.price_data.unit_amount * li.quantity,
      0,
    );
    const applicationFee = bookingApplicationFee(env, totalInPence);

    const session = await stripe.checkout.sessions.create(
      {
        line_items: lineItems,
        mode: "payment",
        ui_mode: "embedded",
        return_url: finalReturnUrl,
        ...(applicationFee != null && {
          payment_intent_data: { application_fee_amount: applicationFee },
        }),
        ...(customerEmail && { customer_email: customerEmail }),
        metadata: {
          userId: userId || "",
          itemCount: String(items.length),
          checkoutType: "class_booking",
          ...bookingMetadata,
        },
      },
      connectRequestOptions(env),
    );

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
