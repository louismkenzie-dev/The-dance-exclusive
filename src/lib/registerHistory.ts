/**
 * Who belongs on a register for a given date.
 *
 * The register used to ask one question — "who is confirmed on this class?" — and ask it with no
 * reference to the date being viewed. That is right for today and wrong for every past date:
 * a dancer who joined in September appeared on August's register, and one who has since left
 * disappeared from the register they actually attended.
 *
 * Amie: "I know we only had three children, if not two, but it's showing all of the students now."
 * On Thursday 10 September, Mixed Street showed 8 where 2 attended, and Competition Team Training
 * showed 2 on a date the class had not started.
 *
 * Three rules, in order of authority:
 *
 *   1. An attendance row wins outright. If they were marked on that session they were there,
 *      whatever has happened to the booking since.
 *   2. A single-session booking (a pass or birthday, with its date written into `notes`) only
 *      counts on its own date. Unchanged — this rule already worked.
 *   3. For a PAST session, the booking must have existed on the day. For today and the future,
 *      nothing changes: the register behaves exactly as it does now.
 */

export type RegisterBookingLike = {
  id: string;
  status?: string | null;
  notes?: string | null;
  /** When the booking was made. Admin can backdate this, so it can precede created_at. */
  booked_at?: string | null;
  created_at?: string | null;
};

const DATED_NOTE = /session (\d{4}-\d{2}-\d{2})/;

/** The date written into a single-session booking's notes, or null for an ongoing one. */
export function datedSessionFromNotes(notes: string | null | undefined): string | null {
  return DATED_NOTE.exec(notes ?? "")?.[1] ?? null;
}

/**
 * The day this booking started existing.
 *
 * `least(booked_at, created_at)`: both are always populated, and a handful are deliberately
 * backdated by admin — booked_at earlier than created_at — so taking the earlier of the two
 * respects "this family really did join in July" rather than the row's insert time.
 */
export function bookingExistedFrom(b: RegisterBookingLike): string | null {
  const dates = [b.booked_at, b.created_at]
    .filter((d): d is string => typeof d === "string" && d.length >= 10)
    .map((d) => d.slice(0, 10))
    .sort();
  return dates[0] ?? null;
}

/** A session is historic once its date is behind today. Today itself is still "live". */
export function isPastSession(sessionDate: string, todayIso: string): boolean {
  return sessionDate.slice(0, 10) < todayIso.slice(0, 10);
}

export type OnRegisterOpts = {
  sessionDate: string;
  todayIso: string;
  /** True when this booking has an attendance row for THIS session. */
  hasAttendance: boolean;
};

/**
 * Should this booking appear on the register for that session?
 *
 * Deliberately permissive about attendance: a row that was marked is shown even if the booking
 * has since been cancelled, because the register is a record of who was in the room.
 */
export function bookingOnRegister(b: RegisterBookingLike, opts: OnRegisterOpts): boolean {
  const { sessionDate, todayIso, hasAttendance } = opts;
  const date = sessionDate.slice(0, 10);

  // 1. They were marked. Nothing else can overrule that.
  if (hasAttendance) return true;

  // 2. A dated booking only ever counts on its own date.
  const dated = datedSessionFromNotes(b.notes);
  if (dated) return dated === date;

  // Only confirmed bookings are expected; an unmarked cancelled one is not on the register.
  if (b.status && b.status !== "confirmed") return false;

  // 3. Past sessions: it had to exist at the time.
  if (!isPastSession(date, todayIso)) return true;
  const from = bookingExistedFrom(b);
  // No usable date on the row — show it rather than silently dropping someone.
  if (!from) return true;
  return from <= date;
}

/** Convenience for the screen: filter a class's bookings down to one session's register. */
export function bookingsForSession<B extends RegisterBookingLike>(
  bookings: B[],
  opts: { sessionDate: string; todayIso: string; attendanceByBooking: Record<string, unknown> },
): B[] {
  return bookings.filter((b) =>
    bookingOnRegister(b, {
      sessionDate: opts.sessionDate,
      todayIso: opts.todayIso,
      hasAttendance: !!opts.attendanceByBooking[b.id],
    }),
  );
}
