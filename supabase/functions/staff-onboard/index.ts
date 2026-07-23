// Public staff self-onboarding. Admin generates a single-use invite link
// (staff_invites row); the staff member opens /staff-onboarding/<token> and
// submits their own details, which land in the staff table for the admin to
// review. Tokens are validated here with the service role — the public form
// never reads or writes the tables directly.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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

const clean = (v: unknown, max = 200): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length > 0 ? s : null;
};

const PHONE_RE = /^\+?[0-9 ()\-]{7,20}$/;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, token, details } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) {
      return jsonResponse({ error: "Invalid invite link" }, 400);
    }

    const { data: invite } = await admin
      .from("staff_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (!invite) return jsonResponse({ error: "This invite link isn't valid." }, 404);
    if (invite.used_at) return jsonResponse({ error: "This invite link has already been used." }, 410);
    if (new Date(invite.expires_at) < new Date()) {
      return jsonResponse({ error: "This invite link has expired — ask the office for a new one." }, 410);
    }

    if (action === "lookup") {
      return jsonResponse({ valid: true, note: invite.note ?? null });
    }

    if (action !== "submit") return jsonResponse({ error: "Unknown action" }, 400);

    const firstName = clean(details?.first_name, 80);
    const lastName = clean(details?.last_name, 80);
    const email = clean(details?.email, 200)?.toLowerCase() ?? null;
    const phone = clean(details?.phone, 30);
    const nokName = clean(details?.next_of_kin_name, 120);
    const nokPhone = clean(details?.next_of_kin_phone, 30);

    if (!firstName || !lastName) return jsonResponse({ error: "Please enter your first and last name." }, 400);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Please enter a valid email address." }, 400);
    }
    if (!phone || !PHONE_RE.test(phone)) {
      return jsonResponse({ error: "Please enter a valid phone number." }, 400);
    }
    if (!nokName || !nokPhone || !PHONE_RE.test(nokPhone)) {
      return jsonResponse({ error: "Please provide a next of kin name and valid phone number." }, 400);
    }

    const payload = {
      full_name: `${firstName} ${lastName}`,
      first_name: firstName,
      last_name: lastName,
      middle_name: clean(details?.middle_name, 80),
      email,
      phone,
      secondary_phone: clean(details?.secondary_phone, 30),
      date_of_birth: clean(details?.date_of_birth, 10),
      address_line1: clean(details?.address_line1),
      address_line2: clean(details?.address_line2),
      city: clean(details?.city, 100),
      county: clean(details?.county, 100),
      postcode: clean(details?.postcode, 12),
      role: clean(details?.role, 100) ?? "instructor",
      description: clean(details?.description, 2000),
      next_of_kin_name: nokName,
      next_of_kin_phone: nokPhone,
      next_of_kin_relationship: clean(details?.next_of_kin_relationship, 60),
      secondary_nok_name: clean(details?.secondary_nok_name, 120),
      secondary_nok_phone: clean(details?.secondary_nok_phone, 30),
      secondary_nok_relationship: clean(details?.secondary_nok_relationship, 60),
      self_employed: Boolean(details?.self_employed),
      drives: Boolean(details?.drives),
      is_active: true,
      onboarding_completed_at: new Date().toISOString(),
    };

    const { data: staffRow, error: staffErr } = await admin
      .from("staff")
      .insert(payload)
      .select("id")
      .single();
    if (staffErr) {
      console.error("staff insert failed:", staffErr);
      return jsonResponse({ error: "Could not save your details — please try again." }, 500);
    }

    // Single-use: burn the token and link the submission.
    await admin
      .from("staff_invites")
      .update({ used_at: new Date().toISOString(), staff_id: staffRow.id })
      .eq("id", invite.id);

    return jsonResponse({ success: true });
  } catch (error: any) {
    console.error("staff-onboard error:", error);
    return jsonResponse({ error: error.message }, 500);
  }
});
