import { describe, expect, it } from "vitest";
import { classDurationMinutes, passCoverageLabel, passCoversClass } from "./passEligibility";

const sixty = { id: "c60", start_time: "19:30:00", end_time: "20:30:00" };
const seventyFive = { id: "c75", start_time: "20:15:00", end_time: "21:30:00" };

describe("classDurationMinutes", () => {
  it("measures the class length", () => {
    expect(classDurationMinutes("19:30:00", "20:30:00")).toBe(60);
    expect(classDurationMinutes("20:15:00", "21:30:00")).toBe(75);
  });

  it("returns null for missing or backwards times", () => {
    expect(classDurationMinutes(null, "20:30:00")).toBeNull();
    expect(classDurationMinutes("20:30:00", "19:30:00")).toBeNull();
  });
});

describe("passCoversClass", () => {
  it("covers everything when nothing is restricted", () => {
    expect(passCoversClass({}, sixty)).toBe(true);
    expect(passCoversClass({ durations: [], classIds: [] }, seventyFive)).toBe(true);
  });

  it("keeps a 60-minute pass off the 75-minute (dearer) classes", () => {
    expect(passCoversClass({ durations: [60] }, sixty)).toBe(true);
    expect(passCoversClass({ durations: [60] }, seventyFive)).toBe(false);
  });

  it("restricts to named classes", () => {
    expect(passCoversClass({ classIds: ["c60"] }, sixty)).toBe(true);
    expect(passCoversClass({ classIds: ["c60"] }, seventyFive)).toBe(false);
  });

  it("requires both restrictions to pass when both are set", () => {
    expect(passCoversClass({ durations: [60], classIds: ["c60"] }, sixty)).toBe(true);
    expect(passCoversClass({ durations: [75], classIds: ["c60"] }, sixty)).toBe(false);
  });

  it("excludes a class whose length can't be worked out", () => {
    expect(passCoversClass({ durations: [60] }, { id: "x", start_time: null, end_time: null })).toBe(false);
    // …but an unrestricted pass still covers it.
    expect(passCoversClass({}, { id: "x", start_time: null, end_time: null })).toBe(true);
  });
});

describe("passCoverageLabel", () => {
  it("describes an unrestricted pass", () => {
    expect(passCoverageLabel({})).toBe("Any adult class");
  });

  it("describes a duration restriction", () => {
    expect(passCoverageLabel({ durations: [60] })).toBe("60 minute classes");
    expect(passCoverageLabel({ durations: [75, 60] })).toBe("60 & 75 minute classes");
  });

  it("names the classes when few, counts them when many", () => {
    const names = new Map([["a", "All Levels Heels"], ["b", "All Levels Hip Hop"], ["c", "Commercial"]]);
    expect(passCoverageLabel({ classIds: ["a"] }, names)).toBe("All Levels Heels");
    expect(passCoverageLabel({ classIds: ["a", "b", "c"] }, names)).toBe("3 selected classes");
  });
});
