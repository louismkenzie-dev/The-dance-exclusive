import { BRAND, ctaButton, divider, escapeHtml, renderLayout } from "./layout.ts";

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
  const totalLine =
    data.totalAmount != null
      ? `<div style="font-size:14px;color:${BRAND.textMuted};">Total paid</div>
         <div style="font-size:32px;font-weight:800;color:${BRAND.text};margin-top:4px;">£${Number(data.totalAmount).toFixed(2)}</div>`
      : "";

  const bookingsHtml = data.bookings
    .map((b) => {
      const time =
        b.startTime && b.endTime
          ? `${b.startTime.slice(0, 5)} – ${b.endTime.slice(0, 5)}`
          : "";
      const venue = b.venueName
        ? `${b.venueName}${b.venueCity ? `, ${b.venueCity}` : ""}`
        : "";
      const day = b.dayOfWeek
        ? b.dayOfWeek.charAt(0).toUpperCase() + b.dayOfWeek.slice(1) + "s"
        : "";
      const planTag = b.bookingType
        ? `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${BRAND.primary}22;color:${BRAND.primary};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${escapeHtml(planLabel[b.bookingType] || b.bookingType)}</span>`
        : "";

      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;margin-bottom:12px;">
        <tr>
          <td style="padding:20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="vertical-align:top;">
                  <div style="font-size:18px;font-weight:700;color:${BRAND.text};line-height:24px;">${escapeHtml(b.className)}</div>
                  ${b.studentName ? `<div style="font-size:13px;color:${BRAND.textMuted};margin-top:4px;">For ${escapeHtml(b.studentName)}</div>` : ""}
                </td>
                <td align="right" style="vertical-align:top;">${planTag}</td>
              </tr>
            </table>
            ${day || time || venue ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid ${BRAND.border};font-size:13px;color:${BRAND.textMuted};line-height:22px;">
              ${day ? `<div>📅 ${escapeHtml(day)}</div>` : ""}
              ${time ? `<div>⏰ ${escapeHtml(time)}</div>` : ""}
              ${venue ? `<div>📍 ${escapeHtml(venue)}</div>` : ""}
            </div>` : ""}
            ${b.amount != null ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid ${BRAND.border};font-size:13px;color:${BRAND.textMuted};">
              Amount <span style="float:right;font-weight:700;color:${BRAND.text};">£${Number(b.amount).toFixed(2)}</span>
            </div>` : ""}
          </td>
        </tr>
      </table>`;
    })
    .join("");

  const body = `
    <div style="text-align:center;margin-bottom:8px;">
      <div style="display:inline-block;width:64px;height:64px;border-radius:50%;background:${BRAND.success}22;line-height:64px;font-size:32px;color:${BRAND.success};">✓</div>
    </div>
    <h1 style="margin:8px 0 8px 0;font-family:'Oswald','Segoe UI',sans-serif;font-size:30px;line-height:36px;font-weight:700;color:${BRAND.text};text-align:center;letter-spacing:0.5px;">
      You're all booked in!
    </h1>
    <p style="margin:0 0 24px 0;font-size:15px;line-height:22px;color:${BRAND.textMuted};text-align:center;">
      Hi ${escapeHtml(greetingName)}, thanks for booking with The Dance Exclusive. Here's your confirmation.
    </p>

    ${totalLine ? `<div style="text-align:center;padding:20px;background:#0d1117;border:1px solid ${BRAND.border};border-radius:10px;margin-bottom:24px;">${totalLine}${data.reference ? `<div style="font-size:11px;color:${BRAND.textMuted};margin-top:8px;font-family:monospace;letter-spacing:1px;">REF: ${escapeHtml(data.reference.slice(-12).toUpperCase())}</div>` : ""}</div>` : ""}

    <div style="font-size:11px;font-weight:700;color:${BRAND.textMuted};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">
      Your Bookings (${data.bookings.length})
    </div>
    ${bookingsHtml}

    ${divider()}

    <div style="text-align:center;">
      ${ctaButton("View My Bookings", `${BRAND.appUrl}/account/bookings`)}
    </div>

    <p style="margin:24px 0 0 0;font-size:13px;line-height:20px;color:${BRAND.textMuted};text-align:center;">
      Need to make a change? Reply to this email or contact us — we're here to help.
    </p>
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
