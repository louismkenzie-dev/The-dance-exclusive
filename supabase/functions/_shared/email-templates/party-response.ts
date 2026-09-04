import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  HERO,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface PartyResponseData {
  parentName?: string | null;
  childName: string;
  /** confirmed = date is theirs; proposed = alternatives offered; declined = can't do it. */
  outcome: "confirmed" | "proposed" | "declined";
  packageName?: string | null;
  /** What Amie is confirming or proposing. */
  partyDate?: string | null; // YYYY-MM-DD
  partyTime?: string | null;
  venue?: string | null;
  /** Agreed price for the party as a whole. */
  quotedTotal?: number | null;
  /** Amie's own words — always shown, never rewritten. */
  message?: string | null;
  /** Set when an invoice goes out with this email. */
  invoice?: {
    kind: "deposit" | "balance";
    amount: number;
    dueDate?: string | null;
    url?: string | null;
  } | null;
}

const prettyDate = (iso: string) => {
  try {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

// No emoji in the headline: Oswald (and the condensed fallbacks) sit badly
// beside Outlook's flat emoji glyph, and the headline icon tile carries the
// celebration in the brand's own style. The subject line keeps its 🎉.
const HEADINGS: Record<PartyResponseData["outcome"], string> = {
  confirmed: "Your party is confirmed!",
  proposed: "About your party date",
  declined: "About your party enquiry",
};

const KICKERS: Record<PartyResponseData["outcome"], string> = {
  confirmed: "Party confirmed",
  proposed: "Party enquiry",
  declined: "Party enquiry",
};

/** Amie's reply to a party enquiry — confirmation, alternatives, or a no. */
export function renderPartyResponse(data: PartyResponseData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const child = escapeHtml(data.childName);

  const intro = data.outcome === "confirmed"
    ? `Hi ${escapeHtml(greetingName)}, brilliant news &mdash; ${child}&#39;s party is booked in with us.`
    : data.outcome === "proposed"
      ? `Hi ${escapeHtml(greetingName)}, thanks for your enquiry about ${child}&#39;s party. We can&#39;t do the exact slot you asked for, but here&#39;s what we can offer.`
      : `Hi ${escapeHtml(greetingName)}, thank you for thinking of us for ${child}&#39;s party.`;

  const hasDetails = data.partyDate || data.partyTime || data.venue || data.packageName || data.quotedTotal != null;

  const detailsPanel = hasDetails && data.outcome !== "declined"
    ? panel(
      `${panelTitle(data.outcome === "confirmed" ? "Your party" : "What we can offer")}
       ${data.packageName ? detailRow("Package", escapeHtml(data.packageName)) : ""}
       ${data.partyDate ? detailRow("Date", escapeHtml(prettyDate(data.partyDate))) : ""}
       ${data.partyTime ? detailRow("Time", escapeHtml(data.partyTime)) : ""}
       ${data.venue ? detailRow("Where", escapeHtml(data.venue)) : ""}
       ${data.quotedTotal != null ? detailRow("Total", `&pound;${Number(data.quotedTotal).toFixed(2)}`) : ""}`,
      { accent: data.outcome === "confirmed" ? "blue" : "magenta" },
    )
    : "";

  const invoicePanel = data.invoice
    ? panel(
      `${panelTitle(data.invoice.kind === "deposit" ? "Deposit to secure the date" : "Balance due")}
       ${detailRow("Amount", `&pound;${Number(data.invoice.amount).toFixed(2)}`)}
       ${data.invoice.dueDate ? detailRow("Due by", escapeHtml(prettyDate(data.invoice.dueDate))) : ""}
       <p style="margin:10px 0 0 0;font-family:${FONT_BODY};font-size:13px;line-height:20px;color:${BRAND.inkMuted};">
         ${data.invoice.url
        ? `Pay securely by card using the button below${data.invoice.dueDate ? ` before ${escapeHtml(prettyDate(data.invoice.dueDate))}` : ""} &mdash; Stripe also emails you a copy of the invoice.`
        : `Stripe emails you the invoice with a secure card payment link${data.invoice.dueDate ? ` &mdash; it&#39;s due by ${escapeHtml(prettyDate(data.invoice.dueDate))}` : ""}. Can&#39;t find it? Just reply to this email.`}
       </p>`,
      { accent: "magenta" },
    )
    : "";

  const body = `
    ${kicker(KICKERS[data.outcome], { align: "center", color: "magenta" })}
    ${heading(HEADINGS[data.outcome], { align: "center" })}
    ${paragraph(intro, { muted: true, align: "center" })}

    ${detailsPanel}

    ${data.message
      ? paragraph(escapeHtml(data.message).replace(/\n/g, "<br />"))
      : ""}

    ${invoicePanel}

    ${data.invoice?.url
      ? ctaButton(
        data.invoice.kind === "deposit" ? "Pay the deposit" : "Pay the balance",
        // The one legitimately off-domain link in the set: Stripe's hosted
        // invoice page, which has no app-side equivalent.
        data.invoice.url,
        "magenta",
      )
      // An invoice with no hosted URL must not fall through to a packages
      // button — the panel has just told them how they'll be asked to pay.
      : data.invoice
        ? ""
        // A family whose party is booked doesn't need selling the packages;
        // anyone still deciding does.
        : data.outcome === "proposed"
          ? ctaButton("See our party packages", `${BRAND.appUrl}/parties`)
          : ""}

    ${divider()}

    ${paragraph(
      `Any questions, just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a>.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  const subject = data.outcome === "confirmed"
    ? `${data.childName}'s party is confirmed 🎉`
    : data.outcome === "proposed"
      ? `About ${data.childName}'s party — some options for you`
      : `About ${data.childName}'s party enquiry`;

  return {
    subject,
    html: renderLayout({
      title: HEADINGS[data.outcome],
      preheader: data.outcome === "confirmed"
        ? `${data.childName}'s party is booked in${data.partyDate ? ` for ${prettyDate(data.partyDate)}` : ""}.`
        : `A reply about ${data.childName}'s party.`,
      body,
      // A "sorry, we can't" email shouldn't open with a celebration photo.
      hero: data.outcome === "declined"
        ? undefined
        : { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" },
      icon: data.outcome === "confirmed" ? "party-popper" : "calendar",
    }),
  };
}
