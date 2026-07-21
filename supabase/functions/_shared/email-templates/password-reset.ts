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

export interface PasswordResetData {
  email: string;
  resetUrl: string;
  fullName?: string | null;
}

export function renderPasswordReset(data: PasswordResetData) {
  const firstName = data.fullName?.split(" ")[0] || "there";

  const body = `
    ${heading("Reset your password")}
    ${paragraph(`Hi ${escapeHtml(firstName)},`)}
    ${paragraph(
      `We received a request to reset the password for <strong>${escapeHtml(data.email)}</strong>. Click the button below to choose a new one. The link will expire in 1 hour.`,
      { muted: true },
    )}

    ${ctaButton("Reset Password", data.resetUrl)}

    ${paragraph(
      `Or copy and paste this link into your browser:<br /><a href="${escapeHtml(data.resetUrl)}" style="color:${BRAND.blueDeep};word-break:break-all;">${escapeHtml(data.resetUrl)}</a>`,
      { muted: true, small: true },
    )}

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
    }),
  };
}
