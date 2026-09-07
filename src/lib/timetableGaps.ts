import { eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import { termsForRange, type TermLike } from "./termMatching";

/**
 * Which dates SHOULD a class have a session on?
 *
 * A class runs on its weekday(s) through every school term it overlaps,
 * between its own first and last class day, skipping school holidays and
 * bank holidays. Any such date with no session row is a gap: either the
 * admin removed it on purpose (hall unavailable, class starts a week late)
 * or it was never generated / got deleted by mistake. Parents can only book
 * dates that have a session row, so a gap on a date someone has already
 * booked means the timetable changed under them.
 */
export const DAY_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

export interface GapClassLike {
  day_of_week: string | null;
  days_of_week: string[] | null;
  term_start: string | null;
  term_end: string | null;
}

export interface DateRange {
  start_date: string;
  end_date: string;
}

const maxIso = (...dates: string[]) => dates.reduce((a, b) => (a > b ? a : b));
const minIso = (...dates: string[]) => dates.reduce((a, b) => (a < b ? a : b));

/** Every date this class should run on, from `fromDate` onwards, sorted. */
export function expectedSessionDates(
  cls: GapClassLike,
  terms: TermLike[],
  holidays: DateRange[],
  fromDate: string,
): string[] {
  const dayNames = cls.days_of_week?.length ? cls.days_of_week : cls.day_of_week ? [cls.day_of_week] : [];
  const days = dayNames
    .map((d) => DAY_INDEX[String(d).toLowerCase()])
    .filter((n): n is number => n !== undefined);
  if (days.length === 0 || !cls.term_start || !cls.term_end) return [];

  const out = new Set<string>();
  for (const term of termsForRange(terms, cls.term_start, cls.term_end)) {
    const start = maxIso(term.start_date, cls.term_start, fromDate);
    const end = minIso(term.end_date, cls.term_end);
    if (start > end) continue;
    for (const d of eachDayOfInterval({ start: parseISO(start), end: parseISO(end) })) {
      if (!days.includes(getDay(d))) continue;
      const iso = format(d, "yyyy-MM-dd");
      if (holidays.some((h) => iso >= h.start_date && iso <= h.end_date)) continue;
      out.add(iso);
    }
  }
  return [...out].sort();
}

/** Expected dates that have no session row (any status counts as present). */
export function missingSessionDates(expected: string[], existing: Iterable<string>): string[] {
  const have = new Set(existing);
  return expected.filter((d) => !have.has(d));
}

export interface TimetableStripDay {
  /** YYYY-MM-DD */
  date: string;
  /** Sessions on that day (after whatever filter the caller applied). */
  count: number;
  /** Nothing to show that day, so it cannot be picked. */
  disabled: boolean;
}

/**
 * Every calendar day of the timetable window, in order, with how many of the
 * given session dates fall on it — the shape a day strip wants. An empty or
 * inverted window yields no days.
 */
export function timetableStripDays(
  sessionDates: Iterable<string>,
  windowStart: string | null | undefined,
  windowEnd: string | null | undefined,
): TimetableStripDay[] {
  if (!windowStart || !windowEnd || windowStart > windowEnd) return [];
  const counts = new Map<string, number>();
  for (const d of sessionDates) counts.set(d, (counts.get(d) ?? 0) + 1);
  return eachDayOfInterval({ start: parseISO(windowStart), end: parseISO(windowEnd) }).map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    const count = counts.get(iso) ?? 0;
    return { date: iso, count, disabled: count === 0 };
  });
}
