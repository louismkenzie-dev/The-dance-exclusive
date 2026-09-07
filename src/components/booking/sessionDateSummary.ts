import { format, parseISO } from "date-fns";

/**
 * Pure helpers behind SessionDatePicker: the "Select all" state and the
 * one-line summary under the strip ("3 dates · 14 Sep – 5 Oct").
 */

export interface SummarisableSession {
  id: string;
  /** YYYY-MM-DD */
  date: string;
}

/** True when every session is selected (and there is at least one). */
export const allSelected = (sessions: SummarisableSession[], value: string[]): boolean =>
  sessions.length > 0 && sessions.every((s) => value.includes(s.id));

/**
 * "Pick your dates" / "Mon 14 Sep" / "3 dates · 14 Sep – 5 Oct". Dates are
 * ordered by the session list, not by the order they were tapped.
 */
export const summariseSelection = (
  sessions: SummarisableSession[],
  value: string[],
  opts?: { noun?: string; empty?: string },
): string => {
  const noun = opts?.noun ?? "date";
  const chosen = sessions.filter((s) => value.includes(s.id));
  if (chosen.length === 0) return opts?.empty ?? `Pick your ${noun}s`;
  if (chosen.length === 1) return format(parseISO(chosen[0].date), "EEE d MMM");
  const first = format(parseISO(chosen[0].date), "d MMM");
  const last = format(parseISO(chosen[chosen.length - 1].date), "d MMM");
  return `${chosen.length} ${noun}s · ${first} – ${last}`;
};
