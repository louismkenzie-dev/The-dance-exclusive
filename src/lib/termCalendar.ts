/**
 * The parent-facing year calendar: terms, breaks and bank holidays in date
 * order, answering the two things parents actually ask — how many weeks a
 * term runs, and when classes come back after a break.
 */
import { differenceInCalendarDays, differenceInCalendarWeeks, parseISO } from "date-fns";

export interface CalendarTerm {
  name: string;
  start_date: string; // YYYY-MM-DD inclusive
  end_date: string;
}

export interface CalendarHoliday {
  name: string;
  holiday_type: string;
  start_date: string;
  end_date: string;
}

export type YearRowKind = "term" | "break" | "bank_holiday";

export interface YearRow {
  kind: YearRowKind;
  name: string;
  start_date: string;
  end_date: string;
  /** Calendar weeks a term touches (a term starting on a Tuesday still
   *  counts that week). Null for breaks and bank holidays. */
  weeks: number | null;
  /** First day classes run again after a school break: the next term's
   *  start. Null for terms and for bank holidays (classes resume next day). */
  backOn: string | null;
  /** Today falls inside this row. */
  current: boolean;
  /** The row has finished. */
  past: boolean;
}

/** 1 September of the academic year containing `today` (YYYY-MM-DD). */
export const academicYearStart = (today: string): string => {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return `${month >= 9 ? year : year - 1}-09-01`;
};

/** Monday-based calendar weeks a date range touches, minimum 1. */
export const weeksSpanned = (start: string, end: string): number =>
  Math.max(1, differenceInCalendarWeeks(parseISO(end), parseISO(start), { weekStartsOn: 1 }) + 1);

const isBankHoliday = (h: CalendarHoliday) => h.holiday_type === "bank_holiday";

/** Gap in days between one date and a later one (Fri → Mon is 3). */
const daysBetween = (from: string, to: string) =>
  differenceInCalendarDays(parseISO(to), parseISO(from));

export interface TermBreak {
  name: string;
  start_date: string;
  end_date: string;
}

/**
 * The break that follows a term: the holidays that begin within a few days
 * of the term ending and run into each other, as one range. An Easter bank
 * holiday weekend followed by the Easter holidays is one break, named after
 * the holiday rather than the weekend. Holidays inside the term (a May bank
 * holiday) are not the break after it.
 */
export const breakAfterTerm = (
  term: CalendarTerm,
  holidays: CalendarHoliday[],
): TermBreak | null => {
  const sorted = [...holidays].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const chain: CalendarHoliday[] = [];
  let edge = term.end_date;
  for (const h of sorted) {
    if (h.start_date <= edge) continue;
    if (daysBetween(edge, h.start_date) > 4) break;
    chain.push(h);
    if (h.end_date > edge) edge = h.end_date;
  }
  if (chain.length === 0) return null;
  const named = chain.find((h) => !isBankHoliday(h)) ?? chain[0];
  return { name: named.name, start_date: chain[0].start_date, end_date: edge };
};

const KIND_ORDER: Record<YearRowKind, number> = { term: 0, break: 1, bank_holiday: 2 };

/**
 * Every term, break and bank holiday from the start of the current academic
 * year onward, in date order, flagged against today.
 */
export const buildYearRows = (
  terms: CalendarTerm[],
  holidays: CalendarHoliday[],
  today: string,
): YearRow[] => {
  const from = academicYearStart(today);
  const sortedTerms = [...terms].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const nextTermStart = (after: string) =>
    sortedTerms.find((t) => t.start_date > after)?.start_date ?? null;
  const flags = (start: string, end: string) => ({
    current: today >= start && today <= end,
    past: end < today,
  });

  const rows: YearRow[] = [];
  for (const t of sortedTerms) {
    if (t.end_date < from) continue;
    rows.push({
      kind: "term",
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      weeks: weeksSpanned(t.start_date, t.end_date),
      backOn: null,
      ...flags(t.start_date, t.end_date),
    });
  }
  for (const h of holidays) {
    if (h.end_date < from) continue;
    const bank = isBankHoliday(h);
    rows.push({
      kind: bank ? "bank_holiday" : "break",
      name: h.name,
      start_date: h.start_date,
      end_date: h.end_date,
      weeks: null,
      backOn: bank ? null : nextTermStart(h.end_date),
      ...flags(h.start_date, h.end_date),
    });
  }
  return rows.sort(
    (a, b) => a.start_date.localeCompare(b.start_date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
};
