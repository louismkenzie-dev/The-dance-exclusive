import {
  BRAND,
  ctaButton,
  divider,
  escapeHtml,
  heading,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface BroadcastData {
  /** Studio-written subject line — also the headline at the top of the email. */
  subject: string;
  /** Plain text, written in the admin composer. Blank lines split paragraphs. */
  body: string;
  recipientName?: string | null;
  /** Optional "read more" link the studio can add to the message. */
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}

/** Only our own app links may be turned into buttons — a broadcast must never
 *  become a way to send a branded link to anywhere on the internet. */
const isSafeUrl = (url: string) =>
  /^https:\/\/([a-z0-9-]+\.)*thedanceexclusive\.co\.uk(\/|$)/i.test(url.trim());

/**
 * A studio-composed message to a group of families or staff. The text is
 * escaped and rendered as paragraphs — the composer writes words, never HTML,
 * so nothing an admin types can break the layout or inject markup.
 */
export function renderBroadcast(data: BroadcastData) {
  const greetingName = data.recipientName?.split(" ")[0]?.trim() || null;

  const paragraphs = data.body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => paragraph(escapeHtml(block).replace(/\n/g, "<br />")))
    .join("");

  const cta =
    data.ctaLabel && data.ctaUrl && isSafeUrl(data.ctaUrl)
      ? ctaButton(data.ctaLabel, data.ctaUrl.trim())
      : "";

  const body = `
    ${heading(escapeHtml(data.subject), { align: "center" })}
    ${greetingName ? paragraph(`Hi ${escapeHtml(greetingName)},`) : ""}
    ${paragraphs}
    ${cta}

    ${divider()}

    ${paragraph(
      `Sent by The Dance Exclusive. Questions? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blueDeep};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: data.subject,
    html: renderLayout({
      title: data.subject,
      preheader: data.body.slice(0, 120),
      body,
    }),
  };
}
