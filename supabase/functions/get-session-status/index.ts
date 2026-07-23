import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { type StripeEnv, connectRequestOptions, createStripeClient } from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    if (!sessionId || typeof sessionId !== "string") {
      return new Response(JSON.stringify({ error: "Invalid sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-authoritative env. Sessions started just before a mode switch
    // live in the other environment — retrieval-only, and both environments
    // are our own accounts, so falling back is safe.
    const env: StripeEnv = await getActiveStripeEnv();
    let session;
    try {
      session = await createStripeClient(env).checkout.sessions.retrieve(sessionId, {}, connectRequestOptions(env));
    } catch (e: any) {
      if (e?.code !== "resource_missing" && e?.statusCode !== 404) throw e;
      const other: StripeEnv = env === "live" ? "sandbox" : "live";
      let otherStripe;
      try {
        otherStripe = createStripeClient(other);
      } catch {
        throw e; // other env not configured — report the original lookup failure
      }
      session = await otherStripe.checkout.sessions.retrieve(sessionId, {}, connectRequestOptions(other));
    }

    return new Response(JSON.stringify({
      status: session.status,
      paymentStatus: session.payment_status,
      customerEmail: session.customer_details?.email,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
