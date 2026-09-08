import { describe, expect, it } from "vitest";
import { arrivalOpensAt, arrivalOpensLabel, arrivalsOpen, registerState } from "./registerRules";

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

describe("registerState", () => {
  it("reads the attendance row the way the register does", () => {
    expect(registerState(null)).toBe("unaccounted");
    expect(registerState({ status: "expected" })).toBe("unaccounted");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z" })).toBe("in");
    expect(registerState({ status: "present", checked_in_at: "2026-09-14T16:50:00Z", checked_out_at: "2026-09-14T17:50:00Z" })).toBe("out");
    expect(registerState({ status: "absent" })).toBe("absent");
  });
});
