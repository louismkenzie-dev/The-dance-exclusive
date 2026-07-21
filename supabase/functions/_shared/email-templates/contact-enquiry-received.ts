import {
  BRAND,
  ctaButton,
  divider,
  escapeHtml,
  eyebrow,
  FONT_STACK,
  panel,
  renderLayout,
} from "./layout.ts";

export interface ContactEnquiryReceivedData {
  name?: string | null;
  subject?: string | null;
  message?: string | null;
}

export function renderContactEnquiryReceived(data: ContactEnquiryReceivedData) {
  const firstName = data.name?.split(" ")[0] || "there";

  const echoBlock =
    data.subject || data.message
      ? `<div style="margin:0 0 24px 0;">
          <div style="margin-bottom:12px;">${eyebrow("Your message")}</div>
          ${panel(`
            ${data.subject ? `<div style="font-family:${FONT_STACK};font-size:14px;font-weight:700;color:${BRAND.text};margin-bottom:${data.message ? "8px" : "0"};">${escapeHtml(data.subject)}</div>` : ""}
            ${data.message ? `<div style="font-family:${FONT_STACK};font-size:13px;line-height:21px;color:${BRAND.textMuted};white-space:pre-line;">${escapeHtml(data.message)}</div>` : ""}
          `)}
        </div>`
      : "";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:28px;line-height:34px;font-weight:800;color:${BRAND.text};letter-spacing:-0.3px;">
      Thanks for getting in touch
    </h1>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      Hi ${escapeHtml(firstName)},
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      We've received your enquiry and a member of our team will reply within 1–2 working days.
    </p>

    ${echoBlock}

    ${ctaButton("Browse our classes", `${BRAND.appUrl}/classes/children`)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      If it's urgent, email us directly at
      <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primary};text-decoration:none;">${BRAND.supportEmail}</a>
      — we're here to help.
    </p>
  `;

  return {
    subject: "We've received your enquiry — The Dance Exclusive",
    html: renderLayout({
      title: "Enquiry received",
      preheader: "Thanks for contacting The Dance Exclusive — we'll reply within 1–2 working days.",
      body,
    }),
  };
}
