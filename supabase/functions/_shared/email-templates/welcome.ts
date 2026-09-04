import {
  BRAND,
  ctaButton,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  HERO,
  kicker,
  panel,
  paragraph,
  renderLayout,
  secondaryLink,
} from "./layout.ts";

export interface WelcomeData {
  fullName?: string | null;
  email: string;
  /**
   * Who the account is for, when the caller knows. Sign-up doesn't ask
   * (Auth.tsx collects name/email/password only), so this is usually absent —
   * and the CTA then goes to the account page rather than guessing. Sending an
   * adult who joined to dance themselves to the children's listing is the one
   * outcome worth designing against.
   */
  audience?: "children" | "adult" | null;
}

function bulletList(items: string[]): string {
  return `<ul style="margin:0;padding:0 0 0 18px;font-family:${FONT_BODY};font-size:14px;line-height:24px;color:${BRAND.inkMuted};">
    ${items.map((i) => `<li style="margin:0 0 4px 0;">${i}</li>`).join("")}
  </ul>`;
}

export function renderWelcome(data: WelcomeData) {
  const firstName = data.fullName?.trim().split(/\s+/)[0] || "there";

  const cta = data.audience === "adult"
    ? { label: "Browse adult classes", url: `${BRAND.appUrl}/classes/adult` }
    : data.audience === "children"
      ? { label: "Browse children's classes", url: `${BRAND.appUrl}/classes/children` }
      : { label: "Set up your account", url: `${BRAND.appUrl}/account` };

  const body = `
    ${kicker("You're in")}
    ${heading(`Welcome, ${escapeHtml(firstName)}.`)}
    ${paragraph(
      `Your account at <strong>The Dance Exclusive</strong> is ready to go.`,
    )}
    ${paragraph(
      `Browse our children&#39;s and adult classes, book in, and manage everything from <strong style="color:${BRAND.ink};">My Account</strong>.`,
      { muted: true },
    )}

    ${ctaButton(cta.label, cta.url)}

    ${heading("What&#39;s next?", { level: 2 })}

    ${panel(
      `${kicker("For your child", { color: "blue" })}
       ${bulletList([
         `Add your child&#39;s profile under <strong style="color:${BRAND.ink};">My Account</strong> &mdash; medical details, allergies and consent all live there`,
         // Trials cost the price of one class (pricing.ts: trialPrice = sessionPrice).
         // The app's own booking dialog says the same; promising "free" here would
         // be a money promise checkout can't honour.
         `Book a trial class to get started &mdash; <strong style="color:${BRAND.ink};">the price of one class</strong>, no commitment`,
       ])}
       ${secondaryLink("Browse children's classes", `${BRAND.appUrl}/classes/children`)}`,
      { accent: "blue" },
    )}

    ${panel(
      `${kicker("Booking for yourself", { color: "magenta" })}
       ${bulletList([
         `Complete your profile under <strong style="color:${BRAND.ink};">My Account</strong>`,
         "Browse adult classes &mdash; no experience needed",
         // Term/monthly/yearly plans are children-only; create-payment-intent
         // rejects them outright for adult classes.
         `Pay as you go by the class, or save with a <strong style="color:${BRAND.ink};">multi-class pass</strong>`,
       ])}
       ${secondaryLink("Browse adult classes", `${BRAND.appUrl}/classes/adult`)}`,
      { accent: "magenta" },
    )}

    ${divider()}

    ${paragraph(
      `Questions? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> &mdash; we're happy to help.`,
      { muted: true, small: true },
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
      hero: { url: HERO.stage, alt: "Dancers under blue and magenta stage lights" },
      icon: "sparkles",
    }),
  };
}
