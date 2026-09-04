import {
  BRAND,
  ctaButton,
  escapeHtml,
  FONT_BODY,
  heading,
  kicker,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface PasswordResetData {
  email: string;
  resetUrl: string;
  fullName?: string | null;
}

export function renderPasswordReset(data: PasswordResetData) {
  const firstName = data.fullName?.trim().split(/\s+/)[0] || "there";

  const body = `
    ${kicker("Account security", { align: "center" })}
    ${heading("Reset your password", { align: "center" })}
    ${paragraph(`Hi ${escapeHtml(firstName)},`, { align: "center" })}
    ${paragraph(
      `We received a request to reset the password for <strong style="color:${BRAND.ink};">${escapeHtml(data.email)}</strong>. Use the button below to choose a new one &mdash; the link expires within the hour.`,
      { muted: true, align: "center" },
    )}

    ${ctaButton("Reset Password", data.resetUrl)}

    ${
    // The reset link carries a single-use token. Printing it as visible text
    // put a long third-party-looking URL in front of a reader who is already
    // being told to be careful — and invited them to mis-copy it. The button
    // carries the link; anyone whose client strips it gets the help line below.
    paragraph(
      `Trouble with the button? Reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we'll get you back in.`,
      { muted: true, small: true, align: "center" },
    )
  }

    ${panel(
      `<p style="margin:0;font-family:${FONT_BODY};font-size:13px;line-height:20px;color:${BRAND.inkMuted};"><strong style="color:${BRAND.ink};">Didn&#39;t request this?</strong> You can safely ignore this email &mdash; your password won&#39;t change unless you click the link above.</p>`,
      { accent: "blue" },
    )}
  `;

  return {
    subject: "Reset your password — The Dance Exclusive",
    html: renderLayout({
      title: "Reset your password",
      preheader: "Use the link inside to set a new password.",
      body,
      icon: "key",
    }),
  };
}
