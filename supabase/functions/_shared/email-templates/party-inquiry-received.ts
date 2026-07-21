import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  eyebrow,
  FONT_STACK,
  panel,
  renderLayout,
} from "./layout.ts";

export interface PartyInquiryReceivedData {
  name?: string | null;
  packageName?: string | null;
  preferredDate?: string | null;
}

export function renderPartyInquiryReceived(data: PartyInquiryReceivedData) {
  const firstName = data.name?.split(" ")[0] || "there";

  const rows = [
    data.packageName ? detailRow("Package", data.packageName) : "",
    data.preferredDate ? detailRow("Preferred date", data.preferredDate) : "",
  ].join("");

  const detailsBlock = rows
    ? `<div style="margin:0 0 24px 0;">
        <div style="margin-bottom:12px;">${eyebrow("Your enquiry")}</div>
        ${panel(rows)}
      </div>`
    : "";

  const body = `
    <h1 style="margin:0 0 16px 0;font-family:${FONT_STACK};font-size:28px;line-height:34px;font-weight:800;color:${BRAND.text};letter-spacing:-0.3px;">
      We've got your party enquiry!
    </h1>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:24px;color:${BRAND.text};">
      Hi ${escapeHtml(firstName)},
    </p>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      Thanks for enquiring about a party with The Dance Exclusive. Here's a summary of what you sent us.
    </p>

    ${detailsBlock}

    <p style="margin:0 0 24px 0;font-size:15px;line-height:24px;color:${BRAND.textMuted};">
      <strong style="color:${BRAND.text};">What happens next?</strong> Our team will check availability and get back to you within 1–2 working days to confirm the details and answer any questions.
    </p>

    ${ctaButton("See our party packages", `${BRAND.appUrl}/parties`)}

    ${divider()}

    <p style="margin:0;font-size:13px;line-height:20px;color:${BRAND.textMuted};">
      Need to add anything to your enquiry? Just reply to this email — we're here to help.
    </p>
  `;

  return {
    subject: "We've received your party enquiry — The Dance Exclusive",
    html: renderLayout({
      title: "Party enquiry received",
      preheader: "Thanks for your party enquiry — we'll be in touch within 1–2 working days.",
      body,
    }),
  };
}
