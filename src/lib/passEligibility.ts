/**
 * Which classes a pass may be spent on.
 *
 * Two independent, optional restrictions — an empty list means "no
 * restriction on this axis", so a pass with neither set works against any
 * adult class (the original behaviour).
 *
 * Duration matters commercially: 60-minute adult classes are £10 and
 * 75-minute ones £12, so a pass priced at 4 x £10 must not be spendable on a
 * £12 class.
 *
 * Mirrored by the same rule in supabase/functions/redeem-pass — this copy
 * decides what a parent is OFFERED, that one decides what is ALLOWED.
 */

export interface PassRestriction {
  /** Class lengths in minutes; empty = any length. */
  durations?: number[] | null;
  /** Specific class ids; empty = all classes. */
  classIds?: string[] | null;
}

/** Class length in whole minutes, or null when the times are unusable. */
export const classDurationMinutes = (
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): number | null => {
  if (!startTime || !endTime) return null;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins : null;
};

/** Whether a pass with these restrictions covers this class. */
export function passCoversClass(
  restriction: PassRestriction,
  cls: { id: string; start_time?: string | null; end_time?: string | null },
): boolean {
  const classIds = restriction.classIds ?? [];
  if (classIds.length > 0 && !classIds.includes(cls.id)) return false;

  const durations = restriction.durations ?? [];
  if (durations.length > 0) {
    const mins = classDurationMinutes(cls.start_time, cls.end_time);
    // A class with no usable times can't be proven to match, so it doesn't.
    if (mins == null || !durations.includes(mins)) return false;
  }
  return true;
}

/** Plain-English summary of what a pass covers, for cards and admin rows. */
export function passCoverageLabel(
  restriction: PassRestriction,
  classNameById?: Map<string, string>,
): string {
  const durations = restriction.durations ?? [];
  const classIds = restriction.classIds ?? [];
  if (classIds.length > 0) {
    const names = classIds
      .map((id) => classNameById?.get(id))
      .filter(Boolean) as string[];
    if (names.length === 0) return `${classIds.length} selected class${classIds.length === 1 ? "" : "es"}`;
    const unique = [...new Set(names)];
    return unique.length <= 2 ? unique.join(" & ") : `${unique.length} selected classes`;
  }
  if (durations.length > 0) {
    const sorted = [...durations].sort((a, b) => a - b);
    return `${sorted.join(" & ")} minute classes`;
  }
  return "Any adult class";
}
