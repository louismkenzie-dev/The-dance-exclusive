// Generic transactional email sender powered by Resend.
// Routes by `template` to the matching renderer in _shared/email-templates.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const FROM_ADDRESS =
  Deno.env.get("EMAIL_FROM") ||
  "The Dance Exclusive <onboarding@resend.dev>";

type Payload =
  | { template: "booking_confirmation"; to: string; data: BookingConfirmationData }
  | { template: "welcome"; to: string; data: WelcomeData }
  | { template: "password_reset"; to: string; data: PasswordResetData }
  | { template: "staff_onboarding"; to: string; data: StaffOnboardingData }
  | { template: "party_inquiry_received"; to: string; data: PartyInquiryReceivedData }
  | { template: "contact_enquiry_received"; to: string; data: ContactEnquiryReceivedData };

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

  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: "RESEND_API_KEY is not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

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
