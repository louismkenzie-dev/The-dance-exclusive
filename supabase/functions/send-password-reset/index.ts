// Generates a Supabase password recovery link, then dispatches our branded
// password reset email through the send-email function. Replaces Supabase's
// default reset email entirely.
//
// NOTE: this function uses the service role to mint a recovery link and does
// NOT confirm or modify the user's account in any other way.

import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// The only host we will ever put in an emailed reset link. `redirectTo` comes
// straight off the request body, so it is matched against this rather than
// trusted — an attacker who could steer the link host could harvest the
// recovery token from a genuine reset email.
const APP_ORIGIN = "https://app.thedanceexclusive.co.uk";

/**
 * Where the emailed link should land. Supabase's own `action_link` points at
 * <project>.supabase.co/auth/v1/verify, which then 302s here — that host in a
 * password email reads as phishing, and link scanners (Outlook Safe Links,
 * Gmail) follow the GET and burn the one-time token before the user clicks,
 * which is how a staff member ended up on "link expired". Linking the app
 * directly with the hashed token keeps the verification server-side at
 * ResetPassword.tsx's verifyOtp call instead.
 */
function resetPageUrl(redirectTo?: string): string {
  try {
    const u = new URL(redirectTo ?? "");
    if (u.origin === APP_ORIGIN) return `${u.origin}${u.pathname}`;
  } catch {
    // Malformed or absent — fall through to the canonical page.
  }
  return `${APP_ORIGIN}/reset-password`;
}

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

    // Prefer the app-hosted token_hash link; keep action_link as the fallback
    // so an unexpected generateLink response still sends a working email.
    const hashedToken = data.properties.hashed_token;
    const resetUrl = hashedToken
      ? `${resetPageUrl(redirectTo)}?token_hash=${encodeURIComponent(hashedToken)}&type=recovery`
      : data.properties.action_link;

    // Dispatch via send-email
    const { error: sendErr } = await supabase.functions.invoke("send-email", {
      headers: { "x-internal-auth": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")! },
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
