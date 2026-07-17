import { describe, it, expect } from "vitest";
import {
  isValidTimeRange,
  isValidAgeRange,
  audienceText,
  titleCaseClassName,
  isClassPubliclyVisible,
  isClassBookable,
} from "./classAudience";

const access = (overrides = {}) => ({
  status: "confirmed",
  publicly_visible: true,
  booking_enabled: true,
  invite_only: false,
  is_active: true,
  ...overrides,
});

const aud = (overrides = {}) => ({
  class_type: "children",
  age_min: null,
  age_max: null,
  school_year_min: null,
  school_year_max: null,
  audience_label: null,
  ...overrides,
});

describe("isValidTimeRange", () => {
  it("accepts end after start", () => {
    expect(isValidTimeRange("17:00", "17:45")).toBe(true);
    expect(isValidTimeRange("08:00:00", "08:45:00")).toBe(true);
  });
  it("rejects zero-duration entries (the 18:45–18:45 Mixed Street case)", () => {
    expect(isValidTimeRange("18:45", "18:45")).toBe(false);
  });
  it("rejects end before start and malformed times", () => {
    expect(isValidTimeRange("19:00", "18:00")).toBe(false);
    expect(isValidTimeRange("", "18:00")).toBe(false);
    expect(isValidTimeRange("25:00", "26:00")).toBe(false);
  });
});

describe("isValidAgeRange", () => {
  it("accepts coherent and incomplete ranges", () => {
    expect(isValidAgeRange(3, 7)).toBe(true);
    expect(isValidAgeRange(null, 7)).toBe(true);
    expect(isValidAgeRange(8, null)).toBe(true);
  });
  it("rejects min above max", () => {
    expect(isValidAgeRange(12, 8)).toBe(false);
  });
});

describe("audienceText", () => {
  it("preserves unconfirmed labels like O17 and 16+U verbatim", () => {
    expect(audienceText(aud({ audience_label: "O17" }))).toBe("O17");
    expect(audienceText(aud({ audience_label: "16+U" }))).toBe("16+U");
  });
  it("renders school-year bands", () => {
    expect(audienceText(aud({ school_year_min: 2, school_year_max: 6 }))).toBe("Year 2–Year 6");
  });
  it("renders age ranges", () => {
    expect(audienceText(aud({ age_min: 3, age_max: 7 }))).toBe("Ages 3–7");
    expect(audienceText(aud({ age_min: 8 }))).toBe("Ages 8+");
  });
  it("falls back to Adults for adult classes without structured data", () => {
    expect(audienceText(aud({ class_type: "adult" }))).toBe("Adults");
  });
});

describe("titleCaseClassName", () => {
  it("title-cases normal names and keeps crew acronyms", () => {
    expect(titleCaseClassName("junior hip hop")).toBe("Junior Hip Hop");
    expect(titleCaseClassName("SURGE crew")).toBe("SURGE Crew");
    expect(titleCaseClassName("NEXUS O17 crew training")).toBe("NEXUS O17 Crew Training");
  });
});

describe("public visibility and booking gates", () => {
  it("shows only active, public, confirmed classes", () => {
    expect(isClassPubliclyVisible(access())).toBe(true);
    expect(isClassPubliclyVisible(access({ status: "provisional" }))).toBe(false);
    expect(isClassPubliclyVisible(access({ status: "draft" }))).toBe(false);
    expect(isClassPubliclyVisible(access({ publicly_visible: false }))).toBe(false);
    expect(isClassPubliclyVisible(access({ is_active: false }))).toBe(false);
  });

  it("never allows booking invite-only sessions", () => {
    expect(isClassBookable(access({ invite_only: true }))).toBe(false);
    expect(isClassBookable(access({ invite_only: true, booking_enabled: true }))).toBe(false);
  });

  it("respects the independent booking_enabled toggle", () => {
    expect(isClassBookable(access())).toBe(true);
    expect(isClassBookable(access({ booking_enabled: false }))).toBe(false);
  });

  it("never allows booking provisional or hidden classes", () => {
    expect(isClassBookable(access({ status: "provisional" }))).toBe(false);
    expect(isClassBookable(access({ publicly_visible: false }))).toBe(false);
  });
});
