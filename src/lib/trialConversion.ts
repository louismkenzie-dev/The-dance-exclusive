/**
 * Did the dancer who took a trial go on to book?
 *
 * The dancer is the unit, not the family. Judging this on the parent alone
 * counted anything anyone in the household bought: Michael Williamson booked
 * himself onto adult hip hop after his son Asher's trial, so Asher was shown
 * as "Booked since — converted" when nothing had been bought for Asher at
 * all. Worse, the same test suppressed the automatic "how was it?" email, so
 * the one family most worth following up never heard from the studio.
 *
 * Adults booking themselves have no student row on some older bookings, so
 * they fall back to the parent id — which is genuinely the same person.
 *
 * Mirror of supabase/functions/_shared/trialConversion.ts — KEEP THE TWO IN SYNC.
 */

export interface Purchase {
  /** The attendee the purchase was for, where one is recorded. */
  studentId: string | null;
  parentId: string;
  /** ISO timestamp the purchase was made. */
  at: string | null;
}

/** Who a booking is actually for, whether or not it names a student. */
export const attendeeKey = (studentId: string | null | undefined, parentId: string): string =>
  studentId || `parent:${parentId}`;

/**
 * True when this attendee bought something after `trialAt`. Anything held
 * before the trial isn't the trial's doing, so the timestamp matters.
 */
export function convertedAfterTrial(
  purchases: Purchase[],
  studentId: string | null | undefined,
  parentId: string,
  trialAt: string,
): boolean {
  const key = attendeeKey(studentId, parentId);
  return purchases.some(
    (p) => !!p.at && p.at > trialAt && attendeeKey(p.studentId, p.parentId) === key,
  );
}
