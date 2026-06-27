import { BRAND, ctaButton, escapeHtml, renderLayout } from "./layout.ts";

export interface StaffOnboardingData {
  fullName?: string | null;
  email: string;
  inviteLink: string;
  role?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  ceo_owner: "CEO / Owner",
  instructor: "Instructor",
  assistant: "Assistant",
  admin: "Admin",
  receptionist: "Receptionist",
  choreographer: "Choreographer",
  volunteer: "Volunteer",
};

export function renderStaffOnboarding(data: StaffOnboardingData) {
  const firstName = data.fullName?.split(" ")[0] || "there";
  const roleLabel = data.role ? (ROLE_LABELS[data.role] || data.role) : "team member";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:'Oswald','Segoe UI',sans-serif;font-size:32px;line-height:38px;font-weight:700;color:${BRAND.text};letter-spacing:0.5px;">
      Welcome to the team, ${escapeHtml(firstName)}.
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      You've been added as a <strong style="color:${BRAND.primary};">${escapeHtml(roleLabel)}</strong> at The Dance Exclusive.
      Your staff account is ready — just set a password to get started.
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      Once you're in, you'll be able to view your upcoming classes, mark registers, upload your DBS &amp; PLI documents, and update your profile.
    </p>

    ${ctaButton("Set My Password", data.inviteLink)}

    <div style="font-size:11px;font-weight:700;color:${BRAND.primary};letter-spacing:1.5px;text-transform:uppercase;margin:32px 0 12px 0;">
      What's inside your portal
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;">
      <tr>
        <td valign="top" style="padding:0 0 12px 0;">
          <div style="padding:18px;background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;border-left:3px solid ${BRAND.primary};">
            <div style="font-size:12px;font-weight:700;color:${BRAND.primary};letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">
              Day-to-day
            </div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>See your <strong style="color:${BRAND.text};">today's &amp; upcoming classes</strong> at a glance</li>
              <li>Check students in/out from class <strong style="color:${BRAND.text};">registers</strong></li>
              <li>View your <strong style="color:${BRAND.text};">class schedule</strong> and venue details</li>
            </ul>
          </div>
        </td>
      </tr>
      <tr>
        <td valign="top" style="padding:0;">
          <div style="padding:18px;background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;border-left:3px solid #e85a9b;">
            <div style="font-size:12px;font-weight:700;color:#e85a9b;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px;">
              First login checklist
            </div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>Set a strong password</li>
              <li>Upload a profile photo &amp; complete your bio</li>
              <li>Add your DBS certificate &amp; PLI documents</li>
              <li>Review your assigned classes</li>
            </ul>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:28px 0 8px 0;font-size:12px;line-height:18px;color:${BRAND.textMuted};">
      Sign-in email: <strong style="color:${BRAND.text};">${escapeHtml(data.email)}</strong><br/>
      This invite link is valid for 7 days. If it expires, ask an admin to resend it.
    </p>
    <p style="margin:20px 0 0 0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      Excited to have you,<br/>The Dance Exclusive team
    </p>
  `;

  return {
    subject: `Welcome to The Dance Exclusive — set your password`,
    html: renderLayout({
      title: "Welcome to the team",
      preheader: "Your staff account is ready — set a password to log in.",
      body,
    }),
  };
}