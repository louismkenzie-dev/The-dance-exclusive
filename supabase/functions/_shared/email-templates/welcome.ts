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

export interface WelcomeData {
  fullName?: string | null;
  email: string;
}

function bulletList(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;font-family:${FONT_BODY};font-size:14px;line-height:24px;color:${BRAND.inkMuted};">
    ${items.map((i) => `<li style="margin:0 0 4px 0;">${i}</li>`).join("")}
  </ul>`;
}

export function renderWelcome(data: WelcomeData) {
  const firstName = data.fullName?.split(" ")[0] || "there";

  const body = `
    ${heading(`Welcome, ${escapeHtml(firstName)}.`)}
    ${paragraph(
      `You&#39;re in. Your account at <strong>The Dance Exclusive</strong> is ready to go.`,
    )}
    ${paragraph(
      "Browse our children&#39;s and adult classes, book trials, and manage everything from your account.",
      { muted: true },
    )}

    ${ctaButton("Browse Classes", `${BRAND.appUrl}/classes/children`)}

    ${heading("What&#39;s next?", { level: 2 })}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.blueDeep};margin-bottom:10px;">For your child</div>
       ${bulletList([
         `Add your child&#39;s profile under <strong style="color:${BRAND.ink};">My Account</strong>`,
         "Sign the medical waiver to complete their profile",
         "Book a free trial class to get started",
       ])}`,
      { accent: "blue" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${BRAND.magenta};margin-bottom:10px;">Booking for yourself</div>
       ${bulletList([
         `Complete your profile under <strong style="color:${BRAND.ink};">My Account</strong>`,
         "Browse adult classes &mdash; no experience needed",
         "Book a drop-in or commit to a full term",
       ])}`,
      { accent: "magenta" },
    )}

    ${paragraph("Welcome to the family,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
    })}
  `;

  return {
    subject: `Welcome to The Dance Exclusive`,
    html: renderLayout({
      title: "Welcome",
      preheader: "Your account is ready — let's get you dancing.",
      body,
    }),
  };
}
