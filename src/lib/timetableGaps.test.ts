import { describe, it, expect } from "vitest";
import { expectedSessionDates, missingSessionDates } from "./timetableGaps";

// Essex autumn 2026: term 1 Tue 1 Sep – Fri 23 Oct, half term, term 2 Mon 2 Nov – Fri 18 Dec.
const terms = [
  { id: "a1", start_date: "2026-09-01", end_date: "2026-10-23" },
  { id: "a2", start_date: "2026-11-02", end_date: "2026-12-18" },
];

describe("expectedSessionDates", () => {
  it("lists every class weekday inside the terms, clamped to the class's own dates", () => {
    const mondays = expectedSessionDates(
      { day_of_week: "monday", days_of_week: ["monday"], term_start: "2026-09-07", term_end: "2026-12-18" },
      terms,
      [],
      "2026-09-01",
    );
    expect(mondays).toEqual([
      "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
      "2026-10-05", "2026-10-12", "2026-10-19",
      "2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30",
      "2026-12-07", "2026-12-14",
    ]);
  });

  it("starts from the given date, so past weeks are not reported", () => {
    const thursdays = expectedSessionDates(
      { day_of_week: "thursday", days_of_week: null, term_start: "2026-09-01", term_end: "2026-10-23" },
      terms,
      [],
      "2026-09-10",
    );
    expect(thursdays[0]).toBe("2026-09-10");
    expect(thursdays).not.toContain("2026-09-03");
  });

  it("skips bank holidays and any school holiday range", () => {
    const mondays = expectedSessionDates(
      { day_of_week: "monday", days_of_week: null, term_start: "2026-09-01", term_end: "2026-12-18" },
      terms,
      [{ start_date: "2026-10-26", end_date: "2026-10-30" }, { start_date: "2026-11-09", end_date: "2026-11-09" }],
      "2026-10-01",
    );
    expect(mondays).toEqual([
      "2026-10-05", "2026-10-12", "2026-10-19",
      "2026-11-02", "2026-11-16", "2026-11-23", "2026-11-30",
      "2026-12-07", "2026-12-14",
    ]);
  });

  it("returns nothing for a class with no weekday or no term dates", () => {
    expect(expectedSessionDates({ day_of_week: null, days_of_week: [], term_start: "2026-09-01", term_end: "2026-12-18" }, terms, [], "2026-09-01")).toEqual([]);
    expect(expectedSessionDates({ day_of_week: "monday", days_of_week: null, term_start: null, term_end: null }, terms, [], "2026-09-01")).toEqual([]);
  });
});

describe("missingSessionDates", () => {
  it("finds the alternate Mondays a fortnightly-generated class is missing", () => {
    const expected = expectedSessionDates(
      { day_of_week: "monday", days_of_week: ["monday"], term_start: "2026-09-07", term_end: "2026-12-18" },
      terms,
      [],
      "2026-09-01",
    );
    const existing = ["2026-09-07", "2026-09-21", "2026-10-05", "2026-10-19", "2026-11-02", "2026-11-16", "2026-11-30", "2026-12-14"];
    expect(missingSessionDates(expected, existing)).toEqual([
      "2026-09-14", "2026-09-28", "2026-10-12", "2026-11-09", "2026-11-23", "2026-12-07",
    ]);
  });

  it("is empty when every expected date has a row", () => {
    expect(missingSessionDates(["2026-09-07", "2026-09-14"], ["2026-09-14", "2026-09-07", "2026-09-21"])).toEqual([]);
  });
});
