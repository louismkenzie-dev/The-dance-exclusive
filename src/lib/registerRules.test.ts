import { describe, expect, it } from "vitest";
import {
  arrivalOpensAt,
  arrivalOpensLabel,
  arrivalsOpen,
  attendanceTarget,
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
    expect(arrivalOpensLabel("2026-09-14", "17:00", new Date("2026-09-14T10:00:00"))).toBe("Opens at 16:45");
    expect(arrivalOpensLabel("2026-09-14", "17:00", new Date("2026-09-13T10:00:00"))).toBe("Opens Mon 14 Sep, 16:45");
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

describe("registerState", () => {
  it("reads the attendance row the way the register does", () => {
    expect(registerState(null)).toBe("unaccounted");
    expect(registerState({ status: "expected" })).toBe("unaccounted");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z" })).toBe("in");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z", checked_out_at: "2026-09-14T17:50:00Z" })).toBe("out");
    expect(registerState({ status: "absent" })).toBe("absent");
  });
});
