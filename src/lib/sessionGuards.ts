import { supabase } from "@/integrations/supabase/client";

/**
 * Guards against deleting a class session that parents have already booked.
 *
 * Trial, pay-as-you-go and class-pass bookings are pinned to a date in their
 * notes ("… | session 2026-09-03"); the register lives in the attendance
 * table. Delete the session row and those bookings are left pointing at a
 * night that no longer exists: the parent still gets the reminder email,
 * still turns up, and nothing on the admin side shows it happened. So a
 * session with bookings on it is "held" — it stays until the bookings are
 * moved or cancelled.
 */
export interface SessionRef {
  id: string;
  class_id: string;
  session_date: string;
}

export interface SessionHold {
  /** Confirmed bookings pinned to this exact date. */
  booked: number;
  /** Register entries (checked in / marked absent) for this session. */
  attended: number;
}

/** Pure: how many of these bookings are pinned to each session (by id). */
export function countPinnedBookings(
  bookings: { class_id: string; notes: string | null }[],
  sessions: SessionRef[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (!b.notes) continue;
    for (const s of sessions) {
      if (s.class_id === b.class_id && b.notes.includes(`session ${s.session_date}`)) {
        counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      }
    }
  }
  return counts;
}

/** Which of these sessions must be kept, and why. Empty map = all clear. */
export async function findHeldSessions(sessions: SessionRef[]): Promise<Map<string, SessionHold>> {
  if (sessions.length === 0) return new Map();
  const classIds = [...new Set(sessions.map((s) => s.class_id))];
  const [{ data: bookings }, { data: attendance }] = await Promise.all([
    supabase
      .from("bookings")
      .select("class_id, notes")
      .in("class_id", classIds)
      .eq("status", "confirmed")
      .ilike("notes", "%session 20%"),
    supabase
      .from("attendance")
      .select("class_session_id")
      .in("class_session_id", sessions.map((s) => s.id)),
  ]);

  const booked = countPinnedBookings(
    (bookings as { class_id: string; notes: string | null }[]) ?? [],
    sessions,
  );
  const attended = new Map<string, number>();
  for (const a of (attendance as { class_session_id: string | null }[]) ?? []) {
    if (a.class_session_id) attended.set(a.class_session_id, (attended.get(a.class_session_id) ?? 0) + 1);
  }

  const held = new Map<string, SessionHold>();
  for (const s of sessions) {
    const hold = { booked: booked.get(s.id) ?? 0, attended: attended.get(s.id) ?? 0 };
    if (hold.booked > 0 || hold.attended > 0) held.set(s.id, hold);
  }
  return held;
}

/** "2 dancers booked, 1 on the register" */
export function describeHold(hold: SessionHold): string {
  const parts: string[] = [];
  if (hold.booked > 0) parts.push(`${hold.booked} dancer${hold.booked === 1 ? "" : "s"} booked`);
  if (hold.attended > 0) parts.push(`${hold.attended} on the register`);
  return parts.join(", ");
}
