import {
  BRAND,
  ctaButton,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
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
  const body = `
    ${heading("New party enquiry", { align: "center" })}
    ${paragraph(
      `<strong>${escapeHtml(data.parentName)}</strong> has enquired about a party for <strong>${escapeHtml(data.childName)}</strong>${data.childAge ? ` (turning ${data.childAge})` : ""}.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">The party</div>
       ${data.packageName ? detailRow("Package", escapeHtml(data.packageName)) : detailRow("Package", "Not sure yet")}
       ${data.preferredDate ? detailRow("Preferred date", escapeHtml(prettyDate(data.preferredDate))) : ""}
       ${data.preferredTime ? detailRow("Preferred time", escapeHtml(data.preferredTime)) : ""}
       ${data.venuePreference ? detailRow("Venue / area", escapeHtml(data.venuePreference)) : ""}
       ${data.guestCount != null ? detailRow("Guests", String(data.guestCount)) : ""}
       ${data.extras?.length ? detailRow("Extras", data.extras.map((e) => escapeHtml(e)).join("<br />")) : ""}`,
      { accent: "magenta" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:13px;line-height:19px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">Contact</div>
       ${detailRow("Name", escapeHtml(data.parentName))}
       ${detailRow("Email", escapeHtml(data.email))}
       ${data.phone ? detailRow("Phone", escapeHtml(data.phone)) : ""}`,
    )}

    ${data.notes
      ? panel(
        `<div style="font-family:${FONT_BODY};font-size:13px;line-height:19px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">What they said</div>
         <p style="margin:0;font-family:${FONT_BODY};font-size:14px;line-height:22px;color:${BRAND.inkMuted};">${escapeHtml(data.notes).replace(/\n/g, "<br />")}</p>`,
        { accent: "blue" },
      )
      : ""}

    ${ctaButton("Open the enquiry", `${BRAND.appUrl}/admin/parties`, "magenta")}

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
    }),
  };
}
