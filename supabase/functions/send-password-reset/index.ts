// Generates a Supabase password recovery link, then dispatches our branded
// password reset email through the send-email function. Replaces Supabase's
// default reset email entirely.
//
// NOTE: this function uses the service role to mint a recovery link and does
// NOT confirm or modify the user's account in any other way.

import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string; redirectTo?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = body?.email?.trim().toLowerCase();
  const redirectTo = body?.redirectTo;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "A valid email is required" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Always respond 200 to avoid leaking which addresses exist.
  try {
    // Try to fetch the user to grab their full name (best-effort)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("email", email)
      .maybeSingle();

    // Generate the recovery link
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: redirectTo ? { redirectTo } : undefined,
    });

    if (error || !data?.properties?.action_link) {
      console.warn("generateLink failed (may be unknown email):", error?.message);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetUrl = data.properties.action_link;

    // Dispatch via send-email
    const { error: sendErr } = await supabase.functions.invoke("send-email", {
      body: {
        template: "password_reset",
        to: email,
        data: {
          email,
          resetUrl,
          fullName: profile?.full_name || null,
        },
      },
    });

    if (sendErr) {
      console.error("send-email failed for password reset:", sendErr);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-password-reset error:", e);
    // Still return 200 to avoid enumeration
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
