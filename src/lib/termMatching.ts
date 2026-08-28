/**
 * Which school terms does a class run in?
 *
 * A class's term_start is its FIRST CLASS DAY, not the term's first calendar
 * day: an Essex autumn term opens Tue 1 September, but a Monday class starts
 * on the 7th. Asking whether the term sits wholly inside the class's dates
 * therefore drops the very term the class belongs to — which is how a class
 * running 7 Sep – 18 Dec came to look like an "Autumn term 2 only" class,
 * silently dropping September from the schedule when it was next saved.
 *
 * The right question is whether the two ranges overlap at all.
 */
export interface TermLike {
  id?: string;
  start_date: string;
  end_date: string;
}

/** True when the term and the class's date range share any day. */
export const termOverlapsRange = (
  term: TermLike,
  rangeStart: string,
  rangeEnd: string,
): boolean => term.start_date <= rangeEnd && term.end_date >= rangeStart;

/**
 * The terms a class spans. Dates are ISO `YYYY-MM-DD`, so string comparison
 * is date comparison — no parsing, no timezone to get wrong.
 */
export const termsForRange = <T extends TermLike>(
  terms: T[],
  rangeStart: string | null | undefined,
  rangeEnd: string | null | undefined,
): T[] => {
  if (!rangeStart || !rangeEnd) return [];
  return terms.filter((t) => termOverlapsRange(t, rangeStart, rangeEnd));
};
