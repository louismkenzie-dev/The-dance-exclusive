import { describe, expect, it } from "vitest";
import { availabilityFor, formatDay, formatPrice, formatTimeRange, initialsFor } from "./bookingFormat";

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
    expect(formatTimeRange("17:00:00", "17:45:00")).toBe("17:00–17:45");
    expect(formatTimeRange("17:00:00", null)).toBe("17:00");
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
