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

/**
 * Which register a session belongs to. A class session has the 15-minute
 * arrival rule; a camp (event) day has no timed rule, matching the database
 * guard, so arrivals may be marked at any time.
 */
export interface RegisterSessionRef {
  id: string;
  kind: "class" | "camp";
  class_id: string | null;
  camp_id?: string | null;
  session_date: string;
  start_time: string;
}

export function sessionArrivalsOpen(session: RegisterSessionRef, now: Date = new Date()): boolean {
  return session.kind === "camp" || arrivalsOpen(session.session_date, session.start_time, now);
}

/**
 * The columns that tie an attendance row to its session, and the unique key
 * an upsert resolves on. Class sessions and camp days keep separate keys.
 */
export function attendanceTarget(session: RegisterSessionRef): {
  keys: Record<string, string | null>;
  onConflict: string;
} {
  return session.kind === "camp"
    ? {
        keys: { class_id: null, camp_id: session.camp_id ?? null, camp_session_id: session.id },
        onConflict: "booking_id,camp_session_id",
      }
    : {
        keys: { class_id: session.class_id, class_session_id: session.id },
        onConflict: "booking_id,class_session_id",
      };
}

/**
 * Whether a booking puts someone in the room on a given date. A booking for
 * a particular date — a trial, a pay-as-you-go session, a pass redemption —
 * carries that date in its notes and only counts on that day. Everything
 * else is a standing weekly place and counts every week.
 */
export function bookingCountsOnDate(notes: string | null | undefined, sessionDate: string): boolean {
  const booked = /session (\d{4}-\d{2}-\d{2})/.exec(notes ?? "")?.[1];
  return !booked || booked === sessionDate;
}

/** The register's read of an attendance row. */
export type RegisterState = "unaccounted" | "in" | "out" | "absent";

export function registerState(att: { status?: string | null; checked_in_at?: string | null; checked_out_at?: string | null } | null | undefined): RegisterState {
  if (att?.status === "absent") return "absent";
  if (att?.checked_out_at) return "out";
  if (att?.checked_in_at) return "in";
  return "unaccounted";
}
