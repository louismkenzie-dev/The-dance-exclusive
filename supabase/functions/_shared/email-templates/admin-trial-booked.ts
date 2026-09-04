import {
  BRAND,
  detailRow,
  divider,
  escapeHtml,
  heading,
  kicker,
  panel,
  panelTitle,
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
  const d = new Date(`${iso}T00:00:00`);
  // Date never throws on bad input — it yields an Invalid Date, so the raw
  // value has to be checked for rather than caught.
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const prettyTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

/** Internal notification to the studio inbox — a new trial has been booked. */
export function renderAdminTrialBooked(data: AdminTrialBookedData) {
  const time = [prettyTime(data.startTime), prettyTime(data.endTime)].filter(Boolean).join(" – ");
  const cap = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : null);

  // Reply-to on every send is the studio's own address, so Reply doesn't reach
  // the parent — the contact details themselves have to be actionable.
  const mailtoRow = (label: string, address: string) =>
    detailRow(
      label,
      `<a href="mailto:${escapeHtml(address.trim())}" style="color:${BRAND.blue};text-decoration:none;">${escapeHtml(address)}</a>`,
    );
  const telRow = (label: string, phone: string) =>
    detailRow(
      label,
      `<a href="tel:${escapeHtml(phone.replace(/\s+/g, ""))}" style="color:${BRAND.blue};text-decoration:none;">${escapeHtml(phone)}</a>`,
    );

  const body = `
    ${kicker("Studio notification", { align: "center" })}
    ${heading("New trial booking", { align: "center" })}
    ${paragraph(
      `A trial has just been booked${data.studentName ? ` for <strong style="color:${BRAND.ink};">${escapeHtml(data.studentName)}</strong>` : ""} — a great chance to make a first impression.`,
      { muted: true, align: "center" },
    )}

    ${panel(
      `${panelTitle(escapeHtml(data.className))}
       ${data.sessionDate ? detailRow("Trial date", escapeHtml(prettyDate(data.sessionDate))) : (data.dayOfWeek ? detailRow("Day", escapeHtml(cap(data.dayOfWeek)!)) : "")}
       ${time ? detailRow("Time", escapeHtml(time)) : ""}
       ${data.venueName ? detailRow("Venue", escapeHtml(data.venueName)) : ""}
       ${data.studentName ? detailRow("Attendee", escapeHtml(data.studentName)) : ""}
       ${data.amount != null ? detailRow("Paid", `&pound;${Number(data.amount).toFixed(2)}`) : ""}`,
      { accent: "blue" },
    )}

    ${panel(
      `${panelTitle("Booked by")}
       ${data.parentName ? detailRow("Name", escapeHtml(data.parentName)) : ""}
       ${data.parentEmail ? mailtoRow("Email", data.parentEmail) : ""}
       ${data.parentPhone ? telRow("Phone", data.parentPhone) : ""}`,
    )}

    ${ctaButton("Open Admin Portal", `${BRAND.appUrl}/admin/bookings`)}

    ${divider()}

    ${paragraph(
      `This is an automatic notification from the booking system — replies come back to the studio inbox, so use the email or phone above to reach the parent.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `New trial booking — ${data.className}${data.studentName ? ` (${data.studentName})` : ""}`,
    html: renderLayout({
      title: "New trial booking",
      preheader: `${data.parentName ?? "A parent"} booked a trial for ${data.studentName ?? "a dancer"} — ${data.className}.`,
      body,
      icon: "calendar-check",
    }),
  };
}
