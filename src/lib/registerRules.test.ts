import { describe, expect, it } from "vitest";
import {
  arrivalOpensAt,
  arrivalOpensLabel,
  arrivalsOpen,
  attendanceTarget,
  bookingCountsOnDate,
  isQuietClass,
  QUIET_CLASS_THRESHOLD,
  registerState,
  sessionArrivalsOpen,
} from "./registerRules";

describe("arrival window", () => {
  it("opens 15 minutes before the start, local time", () => {
    const opens = arrivalOpensAt("2026-09-14", "17:00:00");
    expect(opens.getHours()).toBe(16);
    expect(opens.getMinutes()).toBe(45);
    expect(opens.getDate()).toBe(14);
  });
  it("is closed before the window and open from it", () => {
    const before = new Date("2026-09-14T16:44:59");
    const at = new Date("2026-09-14T16:45:00");
    const after = new Date("2026-09-14T18:30:00");
    expect(arrivalsOpen("2026-09-14", "17:00", before)).toBe(false);
    expect(arrivalsOpen("2026-09-14", "17:00", at)).toBe(true);
    expect(arrivalsOpen("2026-09-14", "17:00", after)).toBe(true);
  });
  it("stays open on later days (retrospective marking)", () => {
    expect(arrivalsOpen("2026-09-14", "17:00", new Date("2026-09-15T09:00:00"))).toBe(true);
  });
  it("labels today by time and other days by date", () => {
    expect(arrivalOpensLabel("2026-09-14", "17:00", new Date("2026-09-14T10:00:00"))).toBe("Opens at 4:45pm");
    expect(arrivalOpensLabel("2026-09-14", "17:00", new Date("2026-09-13T10:00:00"))).toBe("Opens Mon 14 Sep, 4:45pm");
  });
});

describe("sessions", () => {
  const classSession = { id: "cs1", kind: "class" as const, class_id: "c1", session_date: "2026-09-14", start_time: "17:00:00" };
  const campDay = { id: "cd1", kind: "camp" as const, class_id: null, camp_id: "camp1", session_date: "2026-09-14", start_time: "10:00:00" };

  it("applies the arrival window to class sessions only", () => {
    const early = new Date("2026-09-14T08:00:00");
    expect(sessionArrivalsOpen(classSession, early)).toBe(false);
    expect(sessionArrivalsOpen(classSession, new Date("2026-09-14T16:45:00"))).toBe(true);
    expect(sessionArrivalsOpen(campDay, early)).toBe(true);
  });

  it("keys attendance rows to the right session column", () => {
    expect(attendanceTarget(classSession)).toEqual({
      keys: { class_id: "c1", class_session_id: "cs1" },
      onConflict: "booking_id,class_session_id",
    });
    expect(attendanceTarget(campDay)).toEqual({
      keys: { class_id: null, camp_id: "camp1", camp_session_id: "cd1" },
      onConflict: "booking_id,camp_session_id",
    });
  });
});

describe("bookingCountsOnDate", () => {
  it("counts a standing place every week", () => {
    expect(bookingCountsOnDate("Stripe PaymentIntent: pi_1 | monthly", "2026-09-14")).toBe(true);
    expect(bookingCountsOnDate(null, "2026-09-14")).toBe(true);
  });
  it("counts a dated booking only on its own date", () => {
    const notes = "Stripe PaymentIntent: pi_1 | trial | session 2026-09-14";
    expect(bookingCountsOnDate(notes, "2026-09-14")).toBe(true);
    expect(bookingCountsOnDate(notes, "2026-09-21")).toBe(false);
  });
});

describe("isQuietClass", () => {
  it("flags an adult class with fewer than the threshold booked", () => {
    expect(QUIET_CLASS_THRESHOLD).toBe(3);
    expect(isQuietClass("adult", 0)).toBe(true);
    expect(isQuietClass("adult", 2)).toBe(true);
    expect(isQuietClass("adult", 3)).toBe(false);
    expect(isQuietClass("adult", 12)).toBe(false);
  });
  it("never flags a children's class, however small", () => {
    expect(isQuietClass("children", 0)).toBe(false);
    expect(isQuietClass("children", 2)).toBe(false);
    expect(isQuietClass(null, 0)).toBe(false);
    expect(isQuietClass(undefined, 1)).toBe(false);
  });
  it("leaves a cancelled session alone", () => {
    expect(isQuietClass("adult", 0, true)).toBe(false);
  });
  it("leaves a private one-to-one alone", () => {
    expect(isQuietClass("adult", 1, false, true)).toBe(false);
    expect(isQuietClass("adult", 1, false, false)).toBe(true);
  });
});

describe("registerState", () => {
  it("reads the attendance row the way the register does", () => {
    expect(registerState(null)).toBe("unaccounted");
    expect(registerState({ status: "expected" })).toBe("unaccounted");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z" })).toBe("in");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z", checked_out_at: "2026-09-14T17:50:00Z" })).toBe("out");
    expect(registerState({ status: "absent" })).toBe("absent");
  });
});
