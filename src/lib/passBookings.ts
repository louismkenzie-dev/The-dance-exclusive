/**
 * Class-pass bookings on the register.
 *
 * Adults mostly book with a multi-class pass, and until now the register gave
 * the door team no way to tell a pass booking from a paid drop-in. A pass
 * booking is `booking_type = 'pass'`, and its notes carry the pass id it was
 * redeemed against ("Class pass <uuid> — session <date>").
 */

export interface PassBookingLike {
  booking_type?: string | null;
  notes?: string | null;
}

/** Is this booking a redeemed class-pass credit? */
export const isPassBooking = (booking: PassBookingLike): boolean =>
  booking?.booking_type === "pass";

/** The class pass id a pass booking was redeemed against, when recorded. */
export function passIdFromBooking(booking: PassBookingLike): string | null {
  if (!isPassBooking(booking)) return null;
  const match = /Class pass ([0-9a-f-]{36})/i.exec(booking.notes ?? "");
  return match ? match[1] : null;
}

export interface PassSummary {
  /** e.g. "4-class pass" — the studio's own label for the pass type. */
  label: string | null;
  sessionsRemaining: number | null;
  sessionsTotal: number | null;
}

/** Door-friendly one-liner: "4-class pass · 2 of 4 left". */
export function describePass(summary: PassSummary | null | undefined): string {
  const label = summary?.label?.trim() || "Class pass";
  if (summary?.sessionsRemaining == null || summary?.sessionsTotal == null) return label;
  return `${label} · ${summary.sessionsRemaining} of ${summary.sessionsTotal} left`;
}
