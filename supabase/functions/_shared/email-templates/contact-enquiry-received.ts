import {
  BRAND,
  ctaButton,
  detailRow,
  escapeHtml,
  heading,
  kicker,
  panel,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface ContactEnquiryReceivedData {
  name: string;
  topic?: string;
}

export function renderContactEnquiryReceived(data: ContactEnquiryReceivedData) {
  const firstName = data.name?.trim().split(/\s+/)[0] || "there";

  const topicPanel = data.topic
    ? panel(detailRow("Your enquiry", escapeHtml(data.topic)), { accent: "blue" })
    : "";

  const body = `
    ${kicker("Enquiry received", { align: "center" })}
    ${heading("Thanks, we've got it", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(firstName)}, your message has landed safely with the <strong style="color:${BRAND.ink};">Dance Exclusive</strong> team.`,
      { align: "center" },
    )}

    ${topicPanel}

    ${heading("What happens next", { level: 2 })}
    ${paragraph(
      // The Contact page promises a reply within 24 hours; the email has to
      // make the same promise the parent just read.
      `One of the team will reply <strong style="color:${BRAND.ink};">within 24 hours</strong>. There&#39;s nothing else you need to do for now &mdash; we&#39;ll come back to you at this email address.`,
      { muted: true },
    )}
    ${paragraph(
      "While you wait, feel free to have a look at our classes and see what catches your eye.",
      { muted: true },
    )}

    ${ctaButton("Browse Classes", `${BRAND.appUrl}/classes/children`)}

    ${paragraph("Speak soon,<br />The Dance Exclusive team", {
      muted: true,
      small: true,
    })}
  `;

  return {
    subject: "We've received your enquiry — The Dance Exclusive",
    html: renderLayout({
      title: "Enquiry received",
      preheader: "Thanks for your message — we'll reply within 24 hours.",
      body,
      icon: "mail",
    }),
  };
}
