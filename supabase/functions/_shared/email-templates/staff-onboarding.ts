import {
  BRAND,
  ctaButton,
  detailRow,
  escapeHtml,
  FONT_BODY,
  heading,
  HERO,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
  secondaryLink,
} from "./layout.ts";

export interface StaffOnboardingData {
  fullName?: string | null;
  email: string;
  inviteLink: string;
  role?: string | null;
}

// Mirrors ROLE_LABELS in src/pages/admin/Staff.tsx — staff.role is free text,
// so the admin UI's preset values are the only ones we can name confidently.
const ROLE_LABELS: Record<string, string> = {
  ceo_owner: "CEO / Owner",
  instructor: "Instructor",
  assistant_instructor: "Assistant Instructor",
  assistant: "Assistant",
  admin: "Admin",
  receptionist: "Receptionist",
  choreographer: "Choreographer",
  volunteer: "Volunteer",
};

/**
 * Admins can type a free-text role ("other" in the Staff form), and older rows
 * may hold a value that predates the preset list — so anything unrecognised is
 * de-snake-cased rather than shown raw as "assistant_instructor".
 */
function roleLabelFor(role?: string | null): string {
  const key = role?.trim().toLowerCase();
  if (!key) return "team member";
  if (ROLE_LABELS[key]) return ROLE_LABELS[key];
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "a Choreographer" / "an Instructor" — the label decides, not the enum. */
const articleFor = (label: string) => (/^[aeiou]/i.test(label) ? "an" : "a");

function bulletList(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;font-family:${FONT_BODY};font-size:14px;line-height:24px;color:${BRAND.inkMuted};">
    ${items.map((i) => `<li style="margin:0 0 4px 0;">${i}</li>`).join("")}
  </ul>`;
}

export function renderStaffOnboarding(data: StaffOnboardingData) {
  const firstName = data.fullName?.trim().split(/\s+/)[0] || null;
  const roleLabel = roleLabelFor(data.role);
  // "Welcome to the team, there." — the greeting fallback only works in "Hi there".
  const headline = firstName
    ? `Welcome to the team, ${escapeHtml(firstName)}.`
    : "Welcome to the team.";

  const body = `
    ${kicker("Staff onboarding")}
    ${heading(headline)}
    ${paragraph(
      `You&#39;ve been added as ${articleFor(roleLabel)} <strong style="color:${BRAND.ink};">${escapeHtml(roleLabel)}</strong> at The Dance Exclusive. Your staff account is ready &mdash; just set a password to get started.`,
    )}
    ${paragraph(
      "Once you&#39;re in, you&#39;ll be able to view your upcoming classes, mark registers, upload your DBS &amp; PLI documents, and update your profile.",
      { muted: true },
    )}

    ${panel(
      `${panelTitle("Your account")}
       ${detailRow("Sign-in email", escapeHtml(data.email))}
       ${detailRow("Your role", escapeHtml(roleLabel))}`,
    )}

    ${ctaButton("Set My Password", data.inviteLink)}

    ${paragraph(
      `This link <strong style="color:${BRAND.ink};">only works once</strong> and expires within 24 hours of being sent &mdash; so open it on the device you&#39;ll use for the portal, and don&#39;t re-tap it after you&#39;ve set your password. If it stops working, request a fresh one yourself with the link below (no need to wait for the office).`,
      { muted: true, small: true },
    )}
    ${secondaryLink("Send me a new link", `${BRAND.appUrl}/auth?forgot=1`)}

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
      `Stuck getting in? Email <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll sort it.`,
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
      hero: { url: HERO.stage, alt: "Dancers under blue and magenta stage lights" },
      icon: "key",
    }),
  };
}
