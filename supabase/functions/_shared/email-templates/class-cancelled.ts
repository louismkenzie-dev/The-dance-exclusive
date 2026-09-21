import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  heading,
  HERO,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface ClassCancelledData {
  parentName?: string | null;
  /** The class being withdrawn, e.g. "Elmstead Street Dance". */
  className: string;
  venueName?: string | null;
  classType?: "children" | "adult" | null;
  /** The studio's own words. Sent verbatim — blank lines become paragraphs. */
  message: string;
  /** Total refunded to this family, if the studio has already done it. */
  refundedAmount?: number | null;
  /** Where to look at what else is running. */
  browseUrl?: string | null;
}

/**
 * A class is not running any more, and the families on it have to be told.
 *
 * The studio writes the message. That is deliberate: the reason a class is
 * being withdrawn is never the same twice, and a parent can tell the
 * difference between a sentence a person wrote and a sentence a system did.
 * Everything around it — the class, the venue, what has been refunded — is
 * filled in from the booking so nobody has to retype it or get it wrong.
 */
export function renderClassCancelled(data: ClassCancelledData) {
  const greetingName = data.parentName?.trim().split(/\s+/)[0] || "there";
  const hero = data.classType === "adult"
    ? { url: HERO.adults, alt: "Dancer in heels under stage lights" }
    : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" };

  // The studio's message, paragraph by paragraph, escaped but keeping breaks.
  const body = escapeHtml(data.message.trim())
    .split(/\n\s*\n/)
    .map((p) => paragraph(p.replace(/\n/g, "<br />")))
    .join("");

  const money = (n: number) => `£${n.toFixed(2)}`;

  return {
    subject: `${data.className} — an update from The Dance Exclusive`,
    html: renderLayout({
      title: "An update about your class",
      preheader: `${data.className} is not going ahead — here's what it means for your booking.`,
      body: `
        ${kicker("An update about your class", { align: "center" })}
        ${heading(escapeHtml(data.className), { align: "center" })}
        ${paragraph(`Hi ${escapeHtml(greetingName)},`, { muted: true, align: "center" })}

        ${body}

        ${panel(
          `${panelTitle(escapeHtml(data.className))}
           ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
           ${detailRow("Status", "Not running")}
           ${data.refundedAmount != null && data.refundedAmount > 0
             ? detailRow("Refunded", money(data.refundedAmount))
             : ""}`,
          { accent: "blue" },
        )}

        ${data.browseUrl ? ctaButton("See what else is running", data.browseUrl) : ""}

        ${divider()}

        ${paragraph(
          `If you have any questions at all, just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> — we're always happy to help.`,
          { muted: true, small: true, align: "center" },
        )}
      `,
      hero,
      icon: "alert-circle",
    }),
  };
}
