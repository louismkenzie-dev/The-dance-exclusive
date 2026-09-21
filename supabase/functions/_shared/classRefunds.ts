// What a family is owed when a class stops running.
//
// The rule is the plain one a parent would use themselves: you paid for a
// number of classes, some of them haven't happened, you get that share back.
// Which classes a booking covers follows exactly what the bookings page
// already shows Amie (BookingBreakdown), so the number on the refund and the
// number on the card agree:
//
//   dated (trial / pay-as-you-go / pass) — the one date in the notes
//   term    — the class's sessions from the day it was booked to term end
//   yearly  — every session from the day it was booked
//   monthly — the sessions inside the current Stripe billing period
//
// Pure, so it can be tested from the client suite like coupon.ts is.

export interface Coverage {
  /** Sessions the money paid for. */
  total: number;
  /** Of those, the ones that haven't happened yet. */
  left: number;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
export const toPence = (pounds: number) => Math.round(pounds * 100);

/** paid × left/total. Nothing left means nothing owed; all left means all of it. */
export function proRata(paid: number, cov: Coverage): number {
  const p = Number(paid) || 0;
  if (p <= 0 || cov.total <= 0 || cov.left <= 0) return 0;
  if (cov.left >= cov.total) return round2(p);
  return round2((p * cov.left) / cov.total);
}

/** The session date a dated booking is for, from its notes. */
export const datedSession = (notes: string | null | undefined): string | null =>
  /session (\d{4}-\d{2}-\d{2})/.exec(notes ?? "")?.[1] ?? null;

/** The card payment behind a booking, if there was one. */
export const paymentRef = (notes: string | null | undefined): string | null =>
  /pi_[A-Za-z0-9]+/.exec(notes ?? "")?.[0] ?? null;

/** The adult class pass a booking was taken from, if it was. */
export const passRef = (notes: string | null | undefined): string | null =>
  /Class pass ([0-9a-f-]{36})/i.exec(notes ?? "")?.[1] ?? null;

/** True once the refund flow has written its marker — never refund twice. */
export const alreadyRefunded = (notes: string | null | undefined): boolean =>
  /refunded £/.test(notes ?? "");

/**
 * Which of a class's session dates a booking covers.
 * `sessionDates` are the class's non-cancelled sessions, any order.
 * Monthly memberships are not answered here — their window is the Stripe
 * billing period, see `periodCoverage`.
 */
export function bookingCoverage(
  plan: string,
  notes: string | null | undefined,
  bookedDate: string,
  termEnd: string | null | undefined,
  sessionDates: string[],
  today: string,
): Coverage {
  const dated = datedSession(notes);
  if (dated) return { total: 1, left: dated >= today ? 1 : 0 };
  if (plan === "term" || plan === "yearly") {
    const covered = sessionDates.filter(
      (d) => d >= bookedDate && (plan !== "term" || !termEnd || d <= termEnd),
    );
    return { total: covered.length, left: covered.filter((d) => d >= today).length };
  }
  return { total: 0, left: 0 };
}

/** The sessions a monthly payment bought: those inside its billing period. */
export function periodCoverage(
  sessionDates: string[],
  periodStart: string,
  periodEnd: string,
  today: string,
): Coverage {
  const inPeriod = sessionDates.filter((d) => d >= periodStart && d <= periodEnd);
  return { total: inPeriod.length, left: inPeriod.filter((d) => d >= today).length };
}

/**
 * Spread one refund figure across the payments that can carry it, biggest
 * first, never more than each payment has left. Returns what goes where and
 * anything that couldn't be placed (a payment already refunded elsewhere).
 */
export interface RefundRoute {
  /** Booking or membership id — whatever the caller keys on. */
  id: string;
  paymentIntentId: string;
  /** The most this line should carry, in pence — usually its own pro-rata. */
  maxPence: number;
}

export function allocateRefund(
  totalPence: number,
  routes: RefundRoute[],
  remainingByPi: Map<string, number>,
): { plan: { id: string; paymentIntentId: string; pence: number }[]; unplacedPence: number } {
  const plan: { id: string; paymentIntentId: string; pence: number }[] = [];
  const left = new Map(remainingByPi);
  let toPlace = Math.max(0, Math.round(totalPence));
  for (const r of [...routes].sort((a, b) => b.maxPence - a.maxPence)) {
    if (toPlace <= 0) break;
    const room = Math.min(r.maxPence, left.get(r.paymentIntentId) ?? 0);
    const pence = Math.min(room, toPlace);
    if (pence <= 0) continue;
    plan.push({ id: r.id, paymentIntentId: r.paymentIntentId, pence });
    left.set(r.paymentIntentId, (left.get(r.paymentIntentId) ?? 0) - pence);
    toPlace -= pence;
  }
  return { plan, unplacedPence: toPlace };
}

// Same alphabet as the coupon form (no I, O, 0, 1) with the "TDE-" prefix, so
// a personal credit is recognisable at a glance.
export function creditCode(random: () => number = Math.random): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars.charAt(Math.floor(random() * chars.length));
  return `TDE-${out}`;
}
