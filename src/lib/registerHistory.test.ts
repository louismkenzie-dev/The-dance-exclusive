import { describe, it, expect } from "vitest";
import {
  datedSessionFromNotes, bookingExistedFrom, isPastSession,
  bookingOnRegister, bookingsForSession, type RegisterBookingLike,
} from "./registerHistory";

const TODAY = "2026-09-29";
const PAST = "2026-09-10";   // the Thursday Amie was looking at
const FUTURE = "2026-10-08";

const b = (o: Partial<RegisterBookingLike> = {}): RegisterBookingLike => ({
  id: "b1",
  status: "confirmed",
  notes: null,
  booked_at: "2026-08-01T10:00:00Z",
  created_at: "2026-08-01T10:00:00Z",
  ...o,
});

const on = (booking: RegisterBookingLike, sessionDate: string, hasAttendance = false) =>
  bookingOnRegister(booking, { sessionDate, todayIso: TODAY, hasAttendance });

describe("registerHistory", () => {
  describe("existed-from date", () => {
    it("takes the earlier of booked_at and created_at, so a backdated booking is honoured", () => {
      expect(bookingExistedFrom(b({ booked_at: "2026-07-24T09:00:00Z", created_at: "2026-08-15T09:00:00Z" })))
        .toBe("2026-07-24");
      expect(bookingExistedFrom(b({ booked_at: "2026-08-15T09:00:00Z", created_at: "2026-07-24T09:00:00Z" })))
        .toBe("2026-07-24");
    });
    it("copes with one or neither present", () => {
      expect(bookingExistedFrom(b({ booked_at: null }))).toBe("2026-08-01");
      expect(bookingExistedFrom(b({ booked_at: null, created_at: null }))).toBeNull();
    });
  });

  it("treats today as live, not historic", () => {
    expect(isPastSession(TODAY, TODAY)).toBe(false);
    expect(isPastSession(PAST, TODAY)).toBe(true);
    expect(isPastSession(FUTURE, TODAY)).toBe(false);
  });

  describe("the bug Amie reported", () => {
    it("keeps a dancer who joined AFTER the session off that register", () => {
      const joinedLater = b({ booked_at: "2026-09-20T10:00:00Z", created_at: "2026-09-20T10:00:00Z" });
      expect(on(joinedLater, PAST)).toBe(false);
    });

    it("still shows a dancer who was there at the time", () => {
      expect(on(b({ booked_at: "2026-08-01T10:00:00Z" }), PAST)).toBe(true);
    });

    it("shows someone booked on the day itself", () => {
      expect(on(b({ booked_at: `${PAST}T18:00:00Z`, created_at: `${PAST}T18:00:00Z` }), PAST)).toBe(true);
    });

    it("changes nothing for today or the future", () => {
      const joinedYesterday = b({ booked_at: "2026-09-28T10:00:00Z", created_at: "2026-09-28T10:00:00Z" });
      expect(on(joinedYesterday, TODAY)).toBe(true);
      expect(on(joinedYesterday, FUTURE)).toBe(true);
    });
  });

  describe("attendance is the final word", () => {
    it("shows a dancer who was marked even though they have since left", () => {
      const gone = b({ status: "cancelled", booked_at: "2026-08-01T10:00:00Z" });
      expect(on(gone, PAST, false)).toBe(false);
      expect(on(gone, PAST, true)).toBe(true);
    });

    it("shows a marked dancer even if the booking looks like it postdates the session", () => {
      // Data can be untidy; being marked present outranks any inference from timestamps.
      const odd = b({ booked_at: "2026-09-25T10:00:00Z", created_at: "2026-09-25T10:00:00Z" });
      expect(on(odd, PAST, true)).toBe(true);
    });

    it("shows a marked dancer whose dated pass was for another day", () => {
      const pass = b({ notes: "Paid for session 2026-09-17" });
      expect(on(pass, PAST, false)).toBe(false);
      expect(on(pass, PAST, true)).toBe(true);
    });
  });

  describe("single-session bookings keep their existing rule", () => {
    it("appears only on its own date", () => {
      const pass = b({ notes: `Class pass — session ${PAST}` });
      expect(on(pass, PAST)).toBe(true);
      expect(on(pass, "2026-09-17")).toBe(false);
      expect(on(pass, FUTURE)).toBe(false);
    });
    it("is picked out of surrounding prose", () => {
      expect(datedSessionFromNotes("Birthday party, session 2026-09-10, paid cash")).toBe("2026-09-10");
      expect(datedSessionFromNotes("Termly booking")).toBeNull();
      expect(datedSessionFromNotes(null)).toBeNull();
    });
  });

  describe("cancelled bookings", () => {
    it("are hidden when they were never marked", () => {
      expect(on(b({ status: "cancelled" }), PAST)).toBe(false);
      expect(on(b({ status: "cancelled" }), TODAY)).toBe(false);
    });
  });

  describe("bookingsForSession", () => {
    it("rebuilds the Mixed Street case — 8 on the books today, 2 that day", () => {
      const early = Array.from({ length: 2 }, (_, i) =>
        b({ id: `early${i}`, booked_at: "2026-08-20T10:00:00Z", created_at: "2026-08-20T10:00:00Z" }));
      const later = Array.from({ length: 6 }, (_, i) =>
        b({ id: `later${i}`, booked_at: "2026-09-22T10:00:00Z", created_at: "2026-09-22T10:00:00Z" }));
      const rows = bookingsForSession([...early, ...later], {
        sessionDate: PAST, todayIso: TODAY, attendanceByBooking: {},
      });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.id)).toEqual(["early0", "early1"]);
    });

    it("adds back anyone with an attendance row", () => {
      const rows = bookingsForSession(
        [b({ id: "gone", status: "cancelled" }), b({ id: "stayed" })],
        { sessionDate: PAST, todayIso: TODAY, attendanceByBooking: { gone: { checked_in_at: "x" } } },
      );
      expect(rows.map((r) => r.id).sort()).toEqual(["gone", "stayed"]);
    });

    it("leaves a full current register untouched", () => {
      const rows = bookingsForSession([b({ id: "a" }), b({ id: "c" })], {
        sessionDate: TODAY, todayIso: TODAY, attendanceByBooking: {},
      });
      expect(rows).toHaveLength(2);
    });
  });
});
