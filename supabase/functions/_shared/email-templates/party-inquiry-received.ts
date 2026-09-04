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

export interface PartyInquiryReceivedData {
  parentName: string;
  childName?: string;
  packageName?: string;
  /** YYYY-MM-DD as stored — submit-party-inquiry passes the DB value straight through. */
  preferredDate?: string;
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

/** Acknowledgement to the family that their party enquiry arrived. */
export function renderPartyInquiryReceived(data: PartyInquiryReceivedData) {
  const firstName = data.parentName?.split(" ")[0] || "there";

  const rows = [
    // "Birthday star" and "Package" are given explicit tiles: a child's name
    // deserves better than whatever the generic label matcher lands on.
    data.childName ? detailRow("Birthday star", escapeHtml(data.childName), "cake") : "",
    data.packageName ? detailRow("Package", escapeHtml(data.packageName), "party-popper") : "",
    data.preferredDate
      ? detailRow("Preferred date", escapeHtml(prettyDate(data.preferredDate)), "calendar")
      : "",
  ].join("");

  const summaryPanel = rows
    ? panel(`${panelTitle("Your enquiry")}${rows}`, { accent: "blue" })
    : "";

  const body = `
    ${kicker("Birthday parties", { align: "center", color: "magenta" })}
    ${heading("Party enquiry received!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(firstName)}, thanks for getting in touch about a party with <strong style="color:${BRAND.ink};">The Dance Exclusive</strong> &mdash; we&#39;d love to bring the moves${data.childName ? ` for ${escapeHtml(data.childName)}&#39;s big day` : ""}!`,
      { muted: true, align: "center" },
    )}

    ${summaryPanel}

    ${heading("What happens next", { level: 2 })}
    ${paragraph(
      "Your enquiry has landed safely with our parties team, and one of us will get back to you personally to talk dates, packages and all the fun details.",
      { muted: true },
    )}
    ${paragraph(
      "In the meantime, you can browse our party packages to see what&#39;s included.",
      { muted: true },
    )}

    ${ctaButton("See party packages", `${BRAND.appUrl}/parties`)}

    ${divider()}

    ${paragraph(
      `Something to add, or a different date in mind? Just reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> and we&#39;ll pick it up with your enquiry.`,
      { muted: true, small: true, align: "center" },
    )}
    ${paragraph("Speak soon,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
      align: "center",
    })}
  `;

  return {
    subject: "We've got your party enquiry — The Dance Exclusive",
    html: renderLayout({
      title: "Party enquiry received",
      preheader: "Thanks for your party enquiry — we'll be in touch soon.",
      body,
      hero: { url: HERO.kids, alt: "Young dancers mid-move under blue stage lights" },
      icon: "party-popper",
    }),
  };
}
