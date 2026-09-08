/**
 * Who sees which registers.
 *
 * Mirrors the RLS helpers `public.staff_teaches_session` /
 * `public.staff_teaches_class` (see
 * supabase/migrations/20260905120000_register_access_for_assigned_staff.sql).
 * The two must agree: if the page shows a session the database will refuse to
 * open, staff get an empty register with no explanation.
 *
 * The rule:
 *   - Assigned to the CLASS  → every session of that class.
 *   - Assigned to a SESSION  → that session as well. A per-session assignment
 *     ADDS cover staff; it never removes the class-level team. (It used to
 *     replace them, which silently locked assistants out of their own
 *     registers whenever the main teacher was also booked per-session.)
 *   - The studio lead         → every register.
 */

/** The staff-table role that runs the studio and may see every register. */
export const STUDIO_LEAD_STAFF_ROLE = "ceo_owner";

export interface StaffLike {
  role?: string | null;
  is_active?: boolean | null;
}

/** The owner, while their staff record is active. */
export const isStudioLead = (staff?: StaffLike | null): boolean =>
  !!staff && staff.role === STUDIO_LEAD_STAFF_ROLE && staff.is_active !== false;

export interface SessionLike {
  id: string;
  session_date: string;
  start_time: string;
}

export interface MergeSessionsOptions {
  /** Keep only this exact date (YYYY-MM-DD). */
  onDate?: string;
  /** Keep only dates on or after this one (YYYY-MM-DD). */
  fromDate?: string;
  /** Keep only dates on or before this one (YYYY-MM-DD). */
  toDate?: string;
}

/**
 * Combine the session lists from the per-session and class-level queries into
 * one register list.
 *
 * De-duplication matters now that the two queries legitimately overlap: a
 * teacher assigned to the class AND named on a session used to be impossible
 * to see twice, because the class-level list dropped any overridden session.
 * Without a de-dupe that session would render twice on the register.
 */
export function mergeSessions<T extends SessionLike>(
  groups: Array<readonly T[] | null | undefined>,
  { onDate, fromDate, toDate }: MergeSessionsOptions = {},
): T[] {
  const byId = new Map<string, T>();
  for (const group of groups) {
    for (const session of group ?? []) {
      if (!session?.id || !session.session_date) continue;
      if (onDate && session.session_date !== onDate) continue;
      if (fromDate && session.session_date < fromDate) continue;
      if (toDate && session.session_date > toDate) continue;
      if (!byId.has(session.id)) byId.set(session.id, session);
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      a.session_date.localeCompare(b.session_date) ||
      (a.start_time ?? "").localeCompare(b.start_time ?? "") ||
      a.id.localeCompare(b.id),
  );
}
