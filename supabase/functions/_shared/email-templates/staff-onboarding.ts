import {
  BRAND,
  ctaButton,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

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

function bulletList(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;font-family:${FONT_BODY};font-size:14px;line-height:24px;color:${BRAND.inkMuted};">
    ${items.map((i) => `<li style="margin:0 0 4px 0;">${i}</li>`).join("")}
  </ul>`;
}

export function renderStaffOnboarding(data: StaffOnboardingData) {
  const firstName = data.fullName?.split(" ")[0] || "there";
  const roleLabel = data.role ? (ROLE_LABELS[data.role] || data.role) : "team member";

  const body = `
    ${heading(`Welcome to the team, ${escapeHtml(firstName)}.`)}
    ${paragraph(
      `You&#39;ve been added as a <strong>${escapeHtml(roleLabel)}</strong> at The Dance Exclusive. Your staff account is ready &mdash; just set a password to get started.`,
    )}
    ${paragraph(
      "Once you&#39;re in, you&#39;ll be able to view your upcoming classes, mark registers, upload your DBS &amp; PLI documents, and update your profile.",
      { muted: true },
    )}

    ${ctaButton("Set My Password", data.inviteLink)}

    ${heading("What&#39;s inside your portal", { level: 2 })}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.blueDeep};margin-bottom:10px;">Day-to-day</div>
       ${bulletList([
         `See your <strong style="color:${BRAND.ink};">today&#39;s &amp; upcoming classes</strong> at a glance`,
         `Check students in/out from class <strong style="color:${BRAND.ink};">registers</strong>`,
         `View your <strong style="color:${BRAND.ink};">class schedule</strong> and venue details`,
       ])}`,
      { accent: "blue" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.magenta};margin-bottom:10px;">First login checklist</div>
       ${bulletList([
         "Set a strong password",
         "Upload a profile photo &amp; complete your bio",
         "Add your DBS certificate &amp; PLI documents",
         "Review your assigned classes",
       ])}`,
      { accent: "magenta" },
    )}

    ${paragraph(
      `Sign-in email: <strong style="color:${BRAND.ink};">${escapeHtml(data.email)}</strong><br />This invite link is valid for 7 days. If it expires, ask an admin to resend it.`,
      { muted: true, small: true },
    )}
    ${paragraph("Excited to have you,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
    })}
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
