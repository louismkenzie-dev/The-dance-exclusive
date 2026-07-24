import {
  BRAND,
  detailRow,
  divider,
  escapeHtml,
  FONT_BODY,
  heading,
  panel,
  paragraph,
  renderLayout,
  ctaButton,
} from "./layout.ts";

export interface AdminTrialBookedData {
  className: string;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  sessionDate?: string | null;
  studentName?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  amount?: number | null;
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

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** Internal notification to the studio inbox — a new trial has been booked. */
export function renderAdminTrialBooked(data: AdminTrialBookedData) {
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);

  const body = `
    ${heading("New trial booking", { align: "center" })}
    ${paragraph(
      `A trial has just been booked${data.studentName ? ` for <strong>${escapeHtml(data.studentName)}</strong>` : ""} — a great chance to make a first impression.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(data.className)}</div>
       ${data.sessionDate ? detailRow("Trial date", escapeHtml(prettyDate(data.sessionDate))) : (data.dayOfWeek ? detailRow("Day", escapeHtml(cap(data.dayOfWeek)!)) : "")}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.studentName ? detailRow("Attendee", escapeHtml(data.studentName)) : ""}
       ${data.amount != null ? detailRow("Paid", `&pound;${Number(data.amount).toFixed(2)}`) : ""}`,
      { accent: "blue" },
    )}

    ${panel(
      `<div style="font-family:${FONT_BODY};font-size:13px;line-height:19px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">Booked by</div>
       ${data.parentName ? detailRow("Name", escapeHtml(data.parentName)) : ""}
       ${data.parentEmail ? detailRow("Email", escapeHtml(data.parentEmail)) : ""}
       ${data.parentPhone ? detailRow("Phone", escapeHtml(data.parentPhone)) : ""}`,
    )}

    ${ctaButton("Open Admin Portal", `${BRAND.appUrl}/admin/bookings`)}

    ${divider()}

    ${paragraph(
      `This is an automatic notification from the booking system.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `New trial booking — ${data.className}${data.studentName ? ` (${data.studentName})` : ""}`,
    html: renderLayout({
      title: "New trial booking",
      preheader: `${data.studentName ?? "Someone"} booked a trial for ${data.className}.`,
      body,
    }),
  };
}
