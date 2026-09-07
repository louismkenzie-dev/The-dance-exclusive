import { format, parseISO } from "date-fns";

/**
 * Pure helpers behind SessionDatePicker: which tiles are selectable, and the
 * one-line summary under the strip ("3 dates · 14 Sep – 5 Oct").
 */

export interface SelectableSession {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Already in the basket for this attendee — shown, but not selectable. */
  inBasket?: boolean;
}

/** Ids a "Select all" should pick: every session that is not already in the basket. */
export const selectableIds = (sessions: SelectableSession[]): string[] =>
  sessions.filter((s) => !s.inBasket).map((s) => s.id);

/** True when every selectable session is selected (and there is at least one). */
export const allSelected = (sessions: SelectableSession[], value: string[]): boolean => {
  const ids = selectableIds(sessions);
  return ids.length > 0 && ids.every((id) => value.includes(id));
};

/**
 * "Pick your dates" / "Mon 14 Sep" / "3 dates · 14 Sep – 5 Oct". Dates are
 * ordered by the session list, not by the order they were tapped.
 */
export const summariseSelection = (
  sessions: SelectableSession[],
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
