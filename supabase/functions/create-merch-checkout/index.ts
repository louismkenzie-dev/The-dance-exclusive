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
    const { items, customerEmail, origin } = await req.json();

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

    // Who is buying: taken from the signed-in session, never from the request
    // body, so an order can't be filed against someone else's account. Guests
    // may still buy — Stripe collects their email at the checkout page.
    let buyerId: string | null = null;
    let buyerEmail: string | null =
      typeof customerEmail === "string" && customerEmail.includes("@") ? customerEmail : null;
    let buyerName: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      if (user) {
        buyerId = user.id;
        buyerEmail = user.email ?? buyerEmail;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", user.id)
          .maybeSingle();
        buyerName = (profile as any)?.full_name ?? null;
        buyerEmail = buyerEmail ?? (profile as any)?.email ?? null;
      }
    }

    // Server-side price authority: resolve each variant to its real price.
    const variantIds = items.map((i: any) => i.variantId).filter(Boolean);
    const { data: variants, error } = await supabase
      .from("merchandise_variants")
      .select("id, size, item_id, price_override, stock_quantity, is_active, merchandise_items(name, base_price, is_active)")
      .in("id", variantIds);
    if (error) throw error;

    const lineItems: any[] = [];
    const orderLines: any[] = [];
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
      orderLines.push({
        variant_id: v.id,
        item_id: v.item_id,
        product_name: v.merchandise_items.name,
        size: v.size,
        unit_price: price,
        quantity: qty,
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

    // Record the order BEFORE sending anyone to Stripe. Until this existed a
    // paid uniform order left no trace in the system at all — the studio had
    // no list of what to pack, in which size, for whom.
    const { data: order, error: orderError } = await supabase
      .from("merchandise_orders")
      .insert({
        user_id: buyerId,
        customer_email: buyerEmail,
        customer_name: buyerName,
        status: "pending",
        total_amount: merchTotalInPence / 100,
      })
      .select("id")
      .single();
    if (orderError || !order) {
      console.error("create-merch-checkout: could not record order", orderError);
      throw new Error("Could not start your order — please try again.");
    }
    const { error: linesError } = await supabase
      .from("merchandise_order_items")
      .insert(orderLines.map((l) => ({ ...l, order_id: order.id })));
    if (linesError) {
      console.error("create-merch-checkout: could not record order items", linesError);
      await supabase.from("merchandise_orders").delete().eq("id", order.id);
      throw new Error("Could not start your order — please try again.");
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: lineItems,
        success_url: `${baseUrl}/shop?order=success`,
        cancel_url: `${baseUrl}/shop?order=cancelled`,
        phone_number_collection: { enabled: true },
        ...(applicationFee != null && {
          payment_intent_data: { application_fee_amount: applicationFee },
        }),
        ...(buyerEmail && { customer_email: buyerEmail }),
        metadata: { checkoutType: "merch", userId: buyerId || "", merchOrderId: order.id },
      },
      connectRequestOptions(env),
    );

    await supabase
      .from("merchandise_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

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
