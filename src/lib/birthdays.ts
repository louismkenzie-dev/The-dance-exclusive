/**
 * Birthday helpers for registers and checkout perks.
 *
 * A "birthday week" is the Monday–Sunday week containing a given date —
 * weekly classes only meet once, so celebrating on the class nearest the
 * birthday is how the studio actually does it.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Parse "YYYY-MM-DD" as a local date (no timezone shifting). */
const parseYMD = (s: string): Date => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Monday-start week containing the given date. */
export function weekBoundsOf(dateStr: string): { start: Date; end: Date } {
  const d = parseYMD(dateStr);
  const day = d.getDay(); // 0 = Sunday
  const sinceMonday = (day + 6) % 7;
  const start = new Date(d.getTime() - sinceMonday * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { start, end };
}

/**
 * Does this person's birthday fall on `dateStr` ("today") or elsewhere in the
 * Monday–Sunday week containing it ("this-week")? Null when it doesn't, or
 * when the date of birth is missing/unparseable.
 */
export function birthdayInWeekOf(
  dob: string | null | undefined,
  dateStr: string,
): "today" | "this-week" | null {
  if (!dob) return null;
  const b = parseYMD(dob);
  if (isNaN(b.getTime())) return null;
  const on = parseYMD(dateStr);
  if (b.getMonth() === on.getMonth() && b.getDate() === on.getDate()) return "today";

  const { start, end } = weekBoundsOf(dateStr);
  // The week can straddle a year boundary, so try the birthday in both years.
  for (const year of new Set([start.getFullYear(), end.getFullYear()])) {
    const candidate = new Date(year, b.getMonth(), b.getDate());
    if (candidate >= start && candidate <= end) return "this-week";
  }
  return null;
}

/** "29 Aug" — the birthday as it falls in the week of `dateStr`. */
export function birthdayLabel(dob: string, dateStr: string): string {
  const b = parseYMD(dob);
  const { start, end } = weekBoundsOf(dateStr);
  let candidate = new Date(start.getFullYear(), b.getMonth(), b.getDate());
  if (candidate < start || candidate > end) {
    candidate = new Date(end.getFullYear(), b.getMonth(), b.getDate());
  }
  return candidate.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
