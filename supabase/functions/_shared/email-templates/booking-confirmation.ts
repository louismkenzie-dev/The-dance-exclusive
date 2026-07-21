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

export interface BookingItem {
  className: string;
  studentName?: string | null;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  venueCity?: string | null;
  bookingType?: string | null;
  amount?: number | null;
}

export interface BookingConfirmationData {
  parentName?: string | null;
  email: string;
  bookings: BookingItem[];
  totalAmount?: number | null;
  reference?: string | null;
}

const planLabel: Record<string, string> = {
  trial: "Free Trial",
  session: "Per Session",
  monthly: "Monthly",
  term: "Full Term",
  year: "Full Year",
};

export function renderBookingConfirmation(data: BookingConfirmationData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";

  const totalPanel =
    data.totalAmount != null
      ? panel(
          `<div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.inkMuted};text-align:center;">Total paid</div>
           <div style="font-family:${FONT_BODY};font-size:32px;line-height:40px;font-weight:800;color:${BRAND.ink};text-align:center;margin-top:4px;">&pound;${Number(data.totalAmount).toFixed(2)}</div>
           ${data.reference ? `<div style="font-family:monospace;font-size:11px;letter-spacing:1.5px;color:${BRAND.inkMuted};text-align:center;margin-top:8px;">REF: ${escapeHtml(data.reference.slice(-12).toUpperCase())}</div>` : ""}`,
        )
      : "";

  const bookingsHtml = data.bookings
    .map((b) => {
      const time =
        b.startTime && b.endTime
          ? `${b.startTime.slice(0, 5)} &ndash; ${b.endTime.slice(0, 5)}`
          : "";
      const venue = b.venueName
        ? `${b.venueName}${b.venueCity ? `, ${b.venueCity}` : ""}`
        : "";
      const day = b.dayOfWeek
        ? b.dayOfWeek.charAt(0).toUpperCase() + b.dayOfWeek.slice(1) + "s"
        : "";

      const rows = [
        b.studentName ? detailRow("For", escapeHtml(b.studentName)) : "",
        day ? detailRow("Day", escapeHtml(day)) : "",
        time ? detailRow("Time", time) : "",
        venue ? detailRow("Venue", escapeHtml(venue)) : "",
        b.bookingType
          ? detailRow("Plan", escapeHtml(planLabel[b.bookingType] || b.bookingType))
          : "",
        b.amount != null
          ? detailRow("Amount", `&pound;${Number(b.amount).toFixed(2)}`)
          : "",
      ].join("");

      return panel(
        `<div style="font-family:${FONT_BODY};font-size:17px;line-height:24px;font-weight:700;color:${BRAND.ink};margin-bottom:6px;">${escapeHtml(b.className)}</div>
         ${rows}`,
        { accent: "blue" },
      );
    })
    .join("");

  const body = `
    ${heading("You&#39;re booked in!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, thanks for booking with <strong>The Dance Exclusive</strong>. Here&#39;s your confirmation.`,
      { muted: true, align: "center" },
    )}

    ${totalPanel}

    ${heading(`Your bookings (${data.bookings.length})`, { level: 2 })}
    ${bookingsHtml}

    ${divider()}

    ${ctaButton("View My Bookings", `${BRAND.appUrl}/account/bookings`)}

    ${paragraph(
      "Need to make a change? Reply to this email or contact us &mdash; we&#39;re here to help.",
      { muted: true, small: true, align: "center" },
    )}
  `;

  return {
    subject: `Booking confirmed — ${data.bookings[0]?.className || "The Dance Exclusive"}`,
    html: renderLayout({
      title: "Booking confirmed",
      preheader: `Your booking with The Dance Exclusive is confirmed.`,
      body,
    }),
  };
}
