import {
  BRAND,
  ctaButton,
  detailRow,
  escapeHtml,
  heading,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface PartyInquiryReceivedData {
  parentName: string;
  childName?: string;
  packageName?: string;
  preferredDate?: string;
}

export function renderPartyInquiryReceived(data: PartyInquiryReceivedData) {
  const firstName = data.parentName?.split(" ")[0] || "there";

  const rows = [
    data.childName ? detailRow("Birthday star", escapeHtml(data.childName)) : "",
    data.packageName ? detailRow("Package", escapeHtml(data.packageName)) : "",
    data.preferredDate ? detailRow("Preferred date", escapeHtml(data.preferredDate)) : "",
  ].join("");

  const summaryPanel = rows ? panel(rows, { accent: "blue" }) : "";

  const body = `
    ${heading("Party enquiry received!")}
    ${paragraph(
      `Hi ${escapeHtml(firstName)}, thanks for getting in touch about a party with <strong>The Dance Exclusive</strong> &mdash; we&#39;d love to bring the moves${data.childName ? ` for ${escapeHtml(data.childName)}&#39;s big day` : ""}!`,
    )}

    ${summaryPanel}

    ${heading("What happens next", { level: 2 })}
    ${paragraph(
      "Your enquiry has landed safely with our parties team. One of us will reply within <strong>2 working days</strong> to talk dates, packages and all the fun details &mdash; no need to do anything else for now.",
      { muted: true },
    )}
    ${paragraph(
      "In the meantime, you can browse our party packages to see what&#39;s included.",
      { muted: true },
    )}

    ${ctaButton("Explore Party Packages", `${BRAND.appUrl}/parties`)}

    ${paragraph("Speak soon,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
    })}
  `;

  return {
    subject: "We've got your party enquiry — The Dance Exclusive",
    html: renderLayout({
      title: "Party enquiry received",
      preheader: "Thanks for your party enquiry — we'll reply within 2 working days.",
      body,
    }),
  };
}
