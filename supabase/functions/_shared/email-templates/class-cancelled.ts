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
  /** Sent back to the card that paid, if the studio chose that. */
  refundedAmount?: number | null;
  /** Or a one-time studio credit code for their account, if they chose that. */
  creditCode?: string | null;
  creditAmount?: number | null;
  /** ISO — when the credit code stops working. */
  creditExpires?: string | null;
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
  const hasCredit = !!data.creditCode && data.creditAmount != null && data.creditAmount > 0;
  const creditUntil = data.creditExpires
    ? new Date(data.creditExpires).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })
    : null;

  // What happens to their money, in one panel: sent back, or held as credit.
  const settlement = data.refundedAmount != null && data.refundedAmount > 0
    ? panel(
        `${panelTitle("Your refund")}
         ${detailRow("Sent back to your card", money(data.refundedAmount))}
         ${paragraph("It usually shows on your statement within 5–10 working days.", { muted: true, small: true })}`,
        { accent: "blue" },
      )
    : hasCredit
    ? panel(
        `${panelTitle("Your studio credit")}
         ${detailRow("Credit on your account", money(data.creditAmount!))}
         ${detailRow("Your code", `<span style="font-family:Menlo,Consolas,monospace;font-weight:700;letter-spacing:0.08em;">${escapeHtml(data.creditCode!)}</span>`)}
         ${creditUntil ? detailRow("Use it by", escapeHtml(creditUntil)) : ""}
         ${paragraph("Enter the code in the 'Got a code or studio credit?' box at checkout and it comes off the total. It's used in one go, so pop it on a booking worth more than the credit.", { muted: true, small: true })}`,
        { accent: "blue" },
      )
    : "";

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
           ${detailRow("Status", "Not running")}`,
          { accent: "blue" },
        )}

        ${settlement}

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
