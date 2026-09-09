import { describe, expect, it } from "vitest";
import { availabilityFor, durationLabel, formatDay, formatPrice, formatTime, formatTimeRange, initialsFor } from "./bookingFormat";

describe("durationLabel", () => {
  it("reads minutes, whole hours and mixed", () => {
    expect(durationLabel("17:00:00", "17:45:00")).toBe("45 min");
    expect(durationLabel("18:45", "19:45")).toBe("1 hr");
    expect(durationLabel("10:00:00", "11:15:00")).toBe("1 hr 15");
  });
  it("is empty when the times make no sense", () => {
    expect(durationLabel("17:00", "17:00")).toBe("");
    expect(durationLabel(null, "17:00")).toBe("");
    expect(durationLabel("17:00", undefined)).toBe("");
  });
});

describe("formatPrice", () => {
  it("always shows pence unless asked to trim", () => {
    expect(formatPrice(27.2)).toBe("£27.20");
    expect(formatPrice(9)).toBe("£9.00");
    expect(formatPrice(9, { trimZeros: true })).toBe("£9");
    expect(formatPrice(9.5, { trimZeros: true })).toBe("£9.50");
  });
});

describe("formatTimeRange / formatDay", () => {
  it("uses an en dash and drops seconds", () => {
    expect(formatTimeRange("17:00:00", "17:45:00")).toBe("5:00–5:45pm");
    expect(formatTimeRange("17:00:00", null)).toBe("5:00pm");
  });
  it("pluralises and shortens days", () => {
    expect(formatDay("monday")).toBe("Monday");
    expect(formatDay("monday", "plural")).toBe("Mondays");
    expect(formatDay("thursday", "short")).toBe("Thu");
    expect(formatDay(null)).toBe("");
  });
});

describe("availabilityFor", () => {
  it("only mentions numbers when they matter", () => {
    expect(availabilityFor(20, 2).label).toBe("Spaces available");
    expect(availabilityFor(20, 14)).toEqual({ tone: "open", label: "6 spaces left", left: 6 });
    expect(availabilityFor(20, 18)).toEqual({ tone: "low", label: "Only 2 left", left: 2 });
    expect(availabilityFor(20, 19).label).toBe("Only 1 space left");
    expect(availabilityFor(20, 20)).toEqual({ tone: "full", label: "Fully booked", left: 0 });
    expect(availabilityFor(20, 25).left).toBe(0);
  });
  it("treats no capacity as open", () => {
    expect(availabilityFor(null, 5)).toEqual({ tone: "open", label: "Spaces available", left: null });
    expect(availabilityFor(0, 0).tone).toBe("open");
  });
});

describe("initialsFor", () => {
  it("builds two-letter initials", () => {
    expect(initialsFor("Maia", "Woods")).toBe("MW");
    expect(initialsFor("Ava", null)).toBe("A");
    expect(initialsFor(null, null)).toBe("?");
  });
});

describe("12-hour times", () => {
  it("writes a time the way the studio says it", () => {
    expect(formatTime("17:00:00")).toBe("5:00pm");
    expect(formatTime("09:15")).toBe("9:15am");
    expect(formatTime("12:00")).toBe("12:00pm");
    expect(formatTime("00:30")).toBe("12:30am");
    expect(formatTime("23:59")).toBe("11:59pm");
  });
  it("leaves anything that isn't a time alone", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime("")).toBe("");
    expect(formatTime("TBC")).toBe("TBC");
  });
  it("says am/pm once when the class doesn't straddle noon", () => {
    expect(formatTimeRange("17:00", "17:45")).toBe("5:00–5:45pm");
    expect(formatTimeRange("09:00", "10:00")).toBe("9:00–10:00am");
    expect(formatTimeRange("11:30", "12:30")).toBe("11:30am–12:30pm");
    expect(formatTimeRange("17:00", null)).toBe("5:00pm");
  });
});
