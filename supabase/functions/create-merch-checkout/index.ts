import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  bookingApplicationFee,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Merchandise checkout — fully separate from the class-booking payment path.
 * Prices are looked up SERVER-SIDE from the database; the client only sends
 * variant ids + quantities, never amounts. Creates a Stripe Checkout Session.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { items, customerEmail, userId, origin } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Your bag is empty." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Server-side price authority: resolve each variant to its real price.
    const variantIds = items.map((i: any) => i.variantId).filter(Boolean);
    const { data: variants, error } = await supabase
      .from("merchandise_variants")
      .select("id, size, item_id, price_override, stock_quantity, is_active, merchandise_items(name, base_price, is_active)")
      .in("id", variantIds);
    if (error) throw error;

    const lineItems: any[] = [];
    for (const item of items) {
      const v: any = (variants || []).find((x: any) => x.id === item.variantId);
      if (!v || !v.is_active || !v.merchandise_items?.is_active) {
        return new Response(JSON.stringify({ error: "An item in your bag is no longer available." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const qty = Math.max(1, Math.min(20, Number(item.quantity) || 1));
      if (v.stock_quantity != null && v.stock_quantity < qty) {
        return new Response(JSON.stringify({ error: `Only ${v.stock_quantity} left of ${v.merchandise_items.name} (${v.size}).` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const price = Number(v.price_override ?? v.merchandise_items.base_price);
      const unitAmount = Math.round(price * 100);
      lineItems.push({
        quantity: qty,
        price_data: {
          currency: "gbp",
          unit_amount: unitAmount,
          product_data: { name: `${v.merchandise_items.name} — ${v.size}` },
        },
      });
    }

    // Server-authoritative: the request no longer chooses sandbox vs live.
    const env: StripeEnv = await getActiveStripeEnv(supabase);
    const stripe = createStripeClient(env);
    const baseUrl = typeof origin === "string" && origin.startsWith("http") ? origin : "";

    // Direct charge on the connected account so merch revenue settles with
    // The Dance Exclusive. The agreed 1% platform fee applies to every
    // payment, merch included.
    const merchTotalInPence = lineItems.reduce(
      (sum: number, li: any) => sum + li.price_data.unit_amount * li.quantity,
      0,
    );
    const applicationFee = bookingApplicationFee(env, merchTotalInPence);

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        success_url: `${baseUrl}/shop?order=success`,
        cancel_url: `${baseUrl}/shop?order=cancelled`,
        ...(applicationFee != null && {
          payment_intent_data: { application_fee_amount: applicationFee },
        }),
        ...(customerEmail && { customer_email: customerEmail }),
        metadata: { checkoutType: "merch", userId: userId || "" },
      },
      connectRequestOptions(env),
    );

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("create-merch-checkout error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Checkout failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
