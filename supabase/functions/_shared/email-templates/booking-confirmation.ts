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
  secondaryLink,
} from "./layout.ts";

export interface BookingItem {
  /** bookings.id — when present, the entrance QR code link is rendered. */
  id?: string | null;
  className: string;
  studentName?: string | null;
  dayOfWeek?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  /** Pre-formatted date range for camps, e.g. "Mon 27 Jul – Fri 31 Jul". */
  dates?: string | null;
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
  /** A code or studio credit taken off this payment. */
  discountAmount?: number | null;
  discountCode?: string | null;
}

// Wording follows the checkout confirmation page (CheckoutReturn.tsx) so the
// email names the plan exactly as the parent just saw it in the app.
const planLabel: Record<string, string> = {
  trial: "Trial",
  session: "Per Session",
  drop_in: "Drop-in",
  monthly: "Monthly Membership",
  term: "Full Term",
  year: "Full Year",
  yearly: "Full Year",
  camp: "Holiday Workshop",
  pass: "Class Pass",
  birthday: "Birthday Class",
};

/** Any booking_type added later still reads as a label, never as a raw slug. */
const titleCase = (slug: string) =>
  slug
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export function renderBookingConfirmation(data: BookingConfirmationData) {
  const greetingName = data.parentName?.split(" ")[0] || "there";
  const count = data.bookings.length;

  const totalPanel =
    data.totalAmount != null
      ? panel(
          `<div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${BRAND.inkMuted};text-align:center;">Total paid</div>
           <div style="font-family:${FONT_BODY};font-size:32px;line-height:40px;font-weight:700;color:${BRAND.ink};text-align:center;margin-top:4px;">&pound;${Number(data.totalAmount).toFixed(2)}</div>
           ${data.discountAmount != null && Number(data.discountAmount) > 0
             ? `<div style="font-family:${FONT_BODY};font-size:13px;line-height:20px;color:${BRAND.success};text-align:center;margin-top:6px;">Includes &pound;${Number(data.discountAmount).toFixed(2)} off${data.discountCode ? ` with code ${escapeHtml(data.discountCode)}` : ""}</div>`
             : ""}
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
        b.dates ? detailRow("Dates", escapeHtml(b.dates)) : "",
        day ? detailRow("Day", escapeHtml(day)) : "",
        time ? detailRow("Time", time) : "",
        venue ? detailRow("Venue", escapeHtml(venue)) : "",
        b.bookingType
          ? detailRow(
              "Plan",
              escapeHtml(planLabel[b.bookingType] || titleCase(b.bookingType)),
            )
          : "",
        b.amount != null
          ? detailRow("Amount", `&pound;${Number(b.amount).toFixed(2)}`)
          : "",
      ].join("");

      // Per-booking entrance QR: deep-links straight to this booking's QR
      // code on the My Bookings page (?qr= handled portal-side). Kept as a
      // quiet link so the one blue button below stays the primary action.
      const qrLink = b.id
        ? secondaryLink(
            "View entrance QR code",
            `${BRAND.appUrl}/account/bookings?qr=${encodeURIComponent(b.id)}`,
          )
        : "";

      return panel(
        `${panelTitle(escapeHtml(b.className))}
         ${rows}
         ${qrLink}`,
        { accent: "blue" },
      );
    })
    .join("");

  const body = `
    ${kicker("Booking confirmed", { align: "center" })}
    ${heading("You&#39;re booked in!", { align: "center" })}
    ${paragraph(
      `Hi ${escapeHtml(greetingName)}, thanks for booking with <strong style="color:${BRAND.ink};">The Dance Exclusive</strong>. Here&#39;s your confirmation.`,
      { muted: true, align: "center" },
    )}

    ${totalPanel}

    ${heading(count === 1 ? "Your booking" : `Your bookings (${count})`, { level: 2 })}
    ${bookingsHtml}

    ${divider()}

    ${ctaButton("View my bookings", `${BRAND.appUrl}/account/bookings`)}

    ${paragraph(
      `Need to make a change? Reply to this email or contact <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.supportEmail}</a> &mdash; we&#39;re here to help.`,
      { muted: true, small: true, align: "center" },
    )}
  `;

  const firstName = data.bookings[0]?.className || "The Dance Exclusive";

  return {
    subject: `Booking confirmed — ${firstName}${count > 1 ? ` + ${count - 1} more` : ""}`,
    html: renderLayout({
      title: "Booking confirmed",
      preheader: count === 1
        ? "Your booking with The Dance Exclusive is confirmed."
        : `Your ${count} bookings with The Dance Exclusive are confirmed.`,
      body,
      icon: "check-circle",
    }),
  };
}
