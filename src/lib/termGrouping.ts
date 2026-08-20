/**
 * Grouping of class sessions into school terms, split at holidays — so a
 * session list reads "Autumn Term · 13 classes: 7 sessions → half term →
 * 6 sessions" instead of a wall of dates. Used by the admin class builder
 * and the parent-facing session pickers.
 */

export interface TermRange {
  name: string;
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string;
}

export interface HolidayRange {
  name: string;
  start_date: string;
  end_date: string;
}

export interface SessionBlock<S> {
  sessions: S[];
  /** School holiday between this block and the next one in the same term. */
  breakAfter: string | null;
}

export interface TermGroup<S> {
  /** "Autumn, term 1" — the holiday's name for sessions that run during a
   *  school holiday, or "Outside term dates" when neither matches. */
  label: string;
  inTerm: boolean;
  /** True when these sessions run during a school holiday (some classes do). */
  inHoliday: boolean;
  total: number;
  blocks: SessionBlock<S>[];
}

export const OUTSIDE_TERM_LABEL = "Outside term dates";

/**
 * Groups date-sorted sessions by the school term containing them, splitting
 * each term into blocks wherever a school holiday falls between two
 * consecutive sessions.
 *
 * Not every class stops for the holidays — several run right through half
 * term — so sessions landing inside a holiday are grouped under that
 * holiday's own name ("Autumn half term · 2 classes") rather than being
 * lumped into a bare "Outside term dates" group, which reads like a mistake.
 */
export function groupSessionsByTerm<S>(
  sessions: S[],
  dateOf: (s: S) => string,
  terms: TermRange[],
  holidays: HolidayRange[],
): TermGroup<S>[] {
  const sorted = [...sessions].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const sortedTerms = [...terms].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const termFor = (d: string) =>
    sortedTerms.find((t) => d >= t.start_date && d <= t.end_date) ?? null;
  const holidayFor = (d: string) =>
    holidays.find((h) => d >= h.start_date && d <= h.end_date) ?? null;
  /** Holidays intersecting the open gap between two session dates. */
  const holidaysBetween = (d1: string, d2: string) =>
    holidays
      .filter((h) => h.end_date > d1 && h.start_date < d2)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const groups: TermGroup<S>[] = [];
  let currentKey: string | null = null;

  for (const s of sorted) {
    const d = dateOf(s);
    const term = termFor(d);
    const holiday = term ? null : holidayFor(d);
    const key = term
      ? `term:${term.name}|${term.start_date}`
      : holiday
        ? `holiday:${holiday.name}|${holiday.start_date}`
        : "outside";

    if (key !== currentKey || groups.length === 0) {
      groups.push({
        label: term?.name ?? holiday?.name ?? OUTSIDE_TERM_LABEL,
        inTerm: !!term,
        inHoliday: !!holiday,
        total: 0,
        blocks: [{ sessions: [], breakAfter: null }],
      });
      currentKey = key;
    } else {
      const group = groups[groups.length - 1];
      const block = group.blocks[group.blocks.length - 1];
      const prev = block.sessions[block.sessions.length - 1];
      // Sessions grouped UNDER a holiday must not be split by that same
      // holiday — a class running Mon/Wed/Fri of half term is one block.
      if (prev && !group.inHoliday) {
        const between = holidaysBetween(dateOf(prev), d);
        if (between.length > 0) {
          block.breakAfter = [...new Set(between.map((h) => h.name))].join(" · ");
          group.blocks.push({ sessions: [], breakAfter: null });
        }
      }
    }

    const group = groups[groups.length - 1];
    group.blocks[group.blocks.length - 1].sessions.push(s);
    group.total++;
  }

  return groups;
}
