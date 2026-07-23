// Generic transactional email sender powered by Resend.
// Routes by `template` to the matching renderer in _shared/email-templates.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  renderBookingConfirmation,
  type BookingConfirmationData,
} from "../_shared/email-templates/booking-confirmation.ts";
import { renderWelcome, type WelcomeData } from "../_shared/email-templates/welcome.ts";
import {
  renderPasswordReset,
  type PasswordResetData,
} from "../_shared/email-templates/password-reset.ts";
import {
  renderStaffOnboarding,
  type StaffOnboardingData,
} from "../_shared/email-templates/staff-onboarding.ts";
import {
  renderPartyInquiryReceived,
  type PartyInquiryReceivedData,
} from "../_shared/email-templates/party-inquiry-received.ts";
import {
  renderContactEnquiryReceived,
  type ContactEnquiryReceivedData,
} from "../_shared/email-templates/contact-enquiry-received.ts";
import {
  renderMembershipCancelRequested,
  type MembershipCancelRequestedData,
} from "../_shared/email-templates/membership-cancel-requested.ts";
import {
  renderMembershipEnded,
  type MembershipEndedData,
} from "../_shared/email-templates/membership-ended.ts";
import {
  renderMembershipPaymentFailed,
  type MembershipPaymentFailedData,
} from "../_shared/email-templates/membership-payment-failed.ts";
import {
  renderMembershipClassChanged,
  type MembershipClassChangedData,
} from "../_shared/email-templates/membership-class-changed.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-auth",
};

const DEFAULT_FROM = "The Dance Exclusive <onboarding@resend.dev>";

// Resolve a secret/config value: prefer the platform env var (the standard,
// dashboard-managed way — if it's ever set there it wins), otherwise fall back
// to the Vault-stored copy via the service-role-only internal_get_secret RPC.
// This lets email work before a dashboard env secret is configured, and needs
// no code change once one is.
let _admin: ReturnType<typeof createClient> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _admin;
}

const _secretCache = new Map<string, string | null>();
async function getSecret(name: string): Promise<string | null> {
  const env = Deno.env.get(name);
  if (env) return env;
  if (_secretCache.has(name)) return _secretCache.get(name)!;
  let val: string | null = null;
  try {
    const { data, error } = await admin().rpc("internal_get_secret", {
      secret_name: name,
    });
    if (!error && typeof data === "string" && data.length > 0) val = data;
  } catch (e) {
    console.error("getSecret(", name, ") failed:", e);
  }
  _secretCache.set(name, val);
  return val;
}

type Payload =
  | { template: "booking_confirmation"; to: string; data: BookingConfirmationData }
  | { template: "welcome"; to: string; data: WelcomeData }
  | { template: "password_reset"; to: string; data: PasswordResetData }
  | { template: "staff_onboarding"; to: string; data: StaffOnboardingData }
  | { template: "party_inquiry_received"; to: string; data: PartyInquiryReceivedData }
  | { template: "contact_enquiry_received"; to: string; data: ContactEnquiryReceivedData }
  | { template: "membership_cancel_requested"; to: string; data: MembershipCancelRequestedData }
  | { template: "membership_ended"; to: string; data: MembershipEndedData }
  | { template: "membership_payment_failed"; to: string; data: MembershipPaymentFailedData }
  | { template: "membership_class_changed"; to: string; data: MembershipClassChangedData };

function buildEmail(payload: Payload): { subject: string; html: string } {
  switch (payload.template) {
    case "booking_confirmation":
      return renderBookingConfirmation(payload.data);
    case "welcome":
      return renderWelcome(payload.data);
    case "password_reset":
      return renderPasswordReset(payload.data);
    case "staff_onboarding":
      return renderStaffOnboarding(payload.data);
    case "party_inquiry_received":
      return renderPartyInquiryReceived(payload.data);
    case "contact_enquiry_received":
      return renderContactEnquiryReceived(payload.data);
    case "membership_cancel_requested":
      return renderMembershipCancelRequested(payload.data);
    case "membership_ended":
      return renderMembershipEnded(payload.data);
    case "membership_payment_failed":
      return renderMembershipPaymentFailed(payload.data);
    case "membership_class_changed":
      return renderMembershipClassChanged(payload.data);
    default:
      throw new Error(`Unknown template: ${(payload as any).template}`);
  }
}

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

  const RESEND_API_KEY = await getSecret("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
  const FROM_ADDRESS = (await getSecret("EMAIL_FROM")) || DEFAULT_FROM;
  const REPLY_TO = await getSecret("EMAIL_REPLY_TO");

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload?.to || !payload?.template || !payload?.data) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: to, template, data" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // Authorization: templates containing caller-controlled links or booking
  // data can only be sent by our own backend. Server callers authenticate via
  // the Authorization bearer OR the explicit x-internal-auth header — the
  // supabase-js functions.invoke() does not reliably attach the service-role
  // bearer, which silently 403'd booking/membership/reset emails. Only the
  // fixed-content "welcome" template may be triggered from the browser —
  // otherwise this endpoint is an open branded-phishing relay.
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const internal = req.headers.get("x-internal-auth") || "";
  const isServiceCall =
    serviceKey.length > 0 && (bearer === serviceKey || internal === serviceKey);
  if (!isServiceCall && payload.template !== "welcome") {
    return new Response(JSON.stringify({ error: "Not authorized to send this template" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let subject: string;
  let html: string;
  try {
    ({ subject, html } = buildEmail(payload));
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [payload.to],
        subject,
        html,
        ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("Resend API error:", res.status, data);
      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          status: res.status,
          details: data,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Email sent:", payload.template, "→", payload.to, "id:", data?.id);
    return new Response(JSON.stringify({ success: true, id: data?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-email error:", e);
    return new Response(
      JSON.stringify({
        error: "Email send failed",
        details: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
