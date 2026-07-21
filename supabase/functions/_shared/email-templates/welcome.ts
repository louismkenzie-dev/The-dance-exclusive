import {
  BRAND,
  ctaButton,
  escapeHtml,
  eyebrow,
  FONT_STACK,
  renderLayout,
} from "./layout.ts";

export interface WelcomeData {
  fullName?: string | null;
  email: string;
}

export function renderWelcome(data: WelcomeData) {
  const firstName = data.fullName?.split(" ")[0] || "there";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:30px;line-height:36px;font-weight:800;color:${BRAND.text};letter-spacing:-0.3px;">
      Welcome, ${escapeHtml(firstName)}.
    </h1>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      You're in. Your account at <strong style="color:${BRAND.primary};">The Dance Exclusive</strong> is ready to go.
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      Browse our children's and adult classes, book trials, and manage everything from your account.
    </p>

    ${ctaButton("Browse classes", `${BRAND.appUrl}/classes/children`)}

    <div style="margin:32px 0 12px 0;">${eyebrow("What's next?")}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;border-spacing:0;">
      <tr>
        <td width="49%" valign="top" style="padding:0;">
          <div style="padding:18px;background:${BRAND.panelBg};border-radius:16px;">
            <div style="margin-bottom:10px;">${eyebrow("For your child", BRAND.primary)}</div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>Add your child's profile under <strong style="color:${BRAND.text};">My account</strong></li>
              <li>Sign the medical waiver to complete their profile</li>
              <li>Book a free trial class to get started</li>
            </ul>
          </div>
        </td>
        <td width="2%">&nbsp;</td>
        <td width="49%" valign="top" style="padding:0;">
          <div style="padding:18px;background:${BRAND.panelBg};border-radius:16px;">
            <div style="margin-bottom:10px;">${eyebrow("Booking for yourself", BRAND.accent)}</div>
            <ul style="margin:0;padding:0 0 0 18px;font-size:13px;line-height:22px;color:${BRAND.textMuted};">
              <li>Complete your profile under <strong style="color:${BRAND.text};">My account</strong></li>
              <li>Browse adult classes — no experience needed</li>
              <li>Book a drop-in or commit to a full term</li>
            </ul>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:28px 0 0 0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      Welcome to the family,<br/>The Dance Exclusive team
    </p>
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
