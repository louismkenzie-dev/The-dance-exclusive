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

export interface ContactEnquiryReceivedData {
  name: string;
  topic?: string;
}

export function renderContactEnquiryReceived(data: ContactEnquiryReceivedData) {
  const firstName = data.name?.split(" ")[0] || "there";

  const topicPanel = data.topic
    ? panel(detailRow("Your enquiry", escapeHtml(data.topic)), { accent: "blue" })
    : "";

  const body = `
    ${heading("Thanks for getting in touch")}
    ${paragraph(
      `Hi ${escapeHtml(firstName)}, your message has landed safely with the <strong>Dance Exclusive</strong> team.`,
    )}

    ${topicPanel}

    ${heading("What happens next", { level: 2 })}
    ${paragraph(
      "One of the team will reply within <strong>2 working days</strong>. There&#39;s nothing else you need to do for now &mdash; we&#39;ll come back to you at this email address.",
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
      preheader: "Thanks for your message — we'll reply within 2 working days.",
      body,
    }),
  };
}
