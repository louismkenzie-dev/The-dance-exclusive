import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  kicker,
  panel,
  panelTitle,
  paragraph,
  renderLayout,
} from "./layout.ts";

export interface PartyInquiryAdminData {
  inquiryId?: string | null;
  parentName: string;
  email: string;
  phone?: string | null;
  childName: string;
  childAge?: number | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  venuePreference?: string | null;
  guestCount?: number | null;
  packageName?: string | null;
  extras?: string[] | null;
  notes?: string | null;
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

/** Internal notification to the studio inbox — a new party enquiry. */
export function renderPartyInquiryAdmin(data: PartyInquiryAdminData) {
  // Replying to this email reaches the studio's own inbox (send-email sets
  // reply_to to hello@), so the family's details have to be tappable here.
  const telHref = data.phone ? data.phone.replace(/[^\d+]/g, "") : "";
  const link = (href: string, text: string) =>
    `<a href="${href}" style="color:${BRAND.blue};text-decoration:none;">${text}</a>`;

  const body = `
    ${kicker("New party enquiry", { align: "center", color: "magenta" })}
    ${heading(`${escapeHtml(data.childName)}&#39;s party`, { align: "center" })}
    ${paragraph(
      `<strong style="color:${BRAND.ink};">${escapeHtml(data.parentName)}</strong> has enquired about a party for <strong style="color:${BRAND.ink};">${escapeHtml(data.childName)}</strong>${data.childAge ? ` (turning ${data.childAge})` : ""}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle("The party")}
       ${data.packageName ? detailRow("Package", escapeHtml(data.packageName)) : detailRow("Package", "Not sure yet")}
       ${data.preferredDate ? detailRow("Preferred date", escapeHtml(prettyDate(data.preferredDate))) : ""}
       ${data.preferredTime ? detailRow("Preferred time", escapeHtml(data.preferredTime)) : ""}
       ${data.venuePreference ? detailRow("Venue / area", escapeHtml(data.venuePreference)) : ""}
       ${data.guestCount != null ? detailRow("Guests", String(data.guestCount)) : ""}
       ${data.extras?.length ? detailRow("Extras", data.extras.map((e) => escapeHtml(e)).join("<br />")) : ""}`,
      { accent: "magenta" },
    )}

    ${panel(
      `${panelTitle("Contact")}
       ${detailRow("Name", escapeHtml(data.parentName))}
       ${detailRow("Email", link(`mailto:${escapeHtml(data.email)}`, escapeHtml(data.email)))}
       ${data.phone ? detailRow("Phone", link(`tel:${escapeHtml(telHref)}`, escapeHtml(data.phone))) : ""}`,
    )}

    ${data.notes
      ? panel(
        `${panelTitle("What they said")}
         <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:22px;color:${BRAND.inkMuted};">${escapeHtml(data.notes).replace(/\n/g, "<br />")}</p>`,
        { accent: "blue" },
      )
      : ""}

    ${ctaButton("Open the enquiry", `${BRAND.appUrl}/admin/parties`)}

    ${divider()}

    ${paragraph(
      "Reply from the Parties screen to confirm the date, propose alternatives, or send the deposit invoice.",
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `New party enquiry — ${data.childName}${data.preferredDate ? ` (${prettyDate(data.preferredDate)})` : ""}`,
    html: renderLayout({
      title: "New party enquiry",
      preheader: `${data.parentName} enquired about a party for ${data.childName}.`,
      body,
      icon: "party-popper",
    }),
  };
}
