import { BRAND, ctaButton, escapeHtml, FONT_STACK, renderLayout } from "./layout.ts";

export interface PasswordResetData {
  email: string;
  resetUrl: string;
  fullName?: string | null;
}

export function renderPasswordReset(data: PasswordResetData) {
  const firstName = data.fullName?.split(" ")[0] || "there";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:26px;line-height:32px;font-weight:800;color:${BRAND.text};letter-spacing:-0.3px;">
      Reset your password
    </h1>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      Hi ${escapeHtml(firstName)},
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      We received a request to reset the password for <strong style="color:${BRAND.text};">${escapeHtml(data.email)}</strong>. Click the button below to choose a new one. The link will expire in 1 hour.
    </p>

    ${ctaButton("Reset password", data.resetUrl)}

    <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      Or copy and paste this link into your browser:<br/>
      <a href="${escapeHtml(data.resetUrl)}" style="color:${BRAND.primary};word-break:break-all;">${escapeHtml(data.resetUrl)}</a>
    </p>

    <div style="margin-top:32px;padding:16px 20px;background:${BRAND.panelBg};border-radius:16px;">
      <p style="margin:0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
        🔒 <strong style="color:${BRAND.text};">Didn't request this?</strong> You can safely ignore this email — your password won't change unless you click the link above.
      </p>
    </div>
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
