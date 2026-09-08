import { format, isSameDay } from "date-fns";

/** Arrivals may be recorded this many minutes before a class starts. */
export const ARRIVAL_OPENS_MINUTES = 15;

/**
 * When arrivals open for a session, in the device's local time. The database
 * enforces the same rule in Europe/London; on a phone at the door the two
 * agree.
 */
export function arrivalOpensAt(sessionDate: string, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  const d = new Date(`${sessionDate}T00:00:00`);
  d.setHours(h, (m ?? 0) - ARRIVAL_OPENS_MINUTES, 0, 0);
  return d;
}

export function arrivalsOpen(sessionDate: string, startTime: string, now: Date = new Date()): boolean {
  return now.getTime() >= arrivalOpensAt(sessionDate, startTime).getTime();
}

/** "Opens at 16:45" today, otherwise "Opens Mon 14 Sep, 16:45". */
export function arrivalOpensLabel(sessionDate: string, startTime: string, now: Date = new Date()): string {
  const opens = arrivalOpensAt(sessionDate, startTime);
  return isSameDay(opens, now) ? `Opens at ${format(opens, "HH:mm")}` : `Opens ${format(opens, "EEE d MMM, HH:mm")}`;
}

/** The register's read of an attendance row. */
export type RegisterState = "unaccounted" | "in" | "out" | "absent";

export function registerState(att: { status?: string | null; checked_in_at?: string | null; checked_out_at?: string | null } | null | undefined): RegisterState {
  if (att?.status === "absent") return "absent";
  if (att?.checked_out_at) return "out";
  if (att?.checked_in_at) return "in";
  return "unaccounted";
}
