import { describe, expect, it } from "vitest";
import { academicYearStart, breakAfterTerm, buildYearRows, weeksSpanned } from "./termCalendar";

// The live 2026/27 calendar as admin entered it.
const TERMS = [
  { name: "Autumn, term 1", start_date: "2026-09-01", end_date: "2026-10-23" },
  { name: "Autumn, term 2", start_date: "2026-11-02", end_date: "2026-12-18" },
  { name: "Spring, term 3", start_date: "2027-01-04", end_date: "2027-02-12" },
  { name: "Spring, term 4", start_date: "2027-02-22", end_date: "2027-03-25" },
  { name: "Summer, term 5", start_date: "2027-04-12", end_date: "2027-05-28" },
  { name: "Summer, term 6", start_date: "2027-06-07", end_date: "2027-07-21" },
];
const HOLIDAYS = [
  { name: "Autumn half term", holiday_type: "half_term", start_date: "2026-10-26", end_date: "2026-10-30" },
  { name: "Winter holiday (Christmas)", holiday_type: "christmas", start_date: "2026-12-21", end_date: "2026-12-31" },
  { name: "Spring half term", holiday_type: "half_term", start_date: "2027-02-15", end_date: "2027-02-19" },
  { name: "Easter bank holiday", holiday_type: "bank_holiday", start_date: "2027-03-26", end_date: "2027-03-29" },
  { name: "Spring holiday (Easter)", holiday_type: "easter", start_date: "2027-03-30", end_date: "2027-04-09" },
  { name: "Early May bank holiday", holiday_type: "bank_holiday", start_date: "2027-05-03", end_date: "2027-05-03" },
  { name: "Summer half term", holiday_type: "half_term", start_date: "2027-05-31", end_date: "2027-06-04" },
  { name: "Summer holiday", holiday_type: "summer", start_date: "2027-07-22", end_date: "2027-08-31" },
];

describe("academicYearStart", () => {
  it("is 1 September of the year the academic year began", () => {
    expect(academicYearStart("2026-09-05")).toBe("2026-09-01");
    expect(academicYearStart("2027-03-01")).toBe("2026-09-01");
    expect(academicYearStart("2027-08-20")).toBe("2026-09-01");
    expect(academicYearStart("2027-09-01")).toBe("2027-09-01");
  });
});

describe("weeksSpanned", () => {
  it("counts the calendar weeks a term touches", () => {
    expect(weeksSpanned("2026-09-01", "2026-10-23")).toBe(8); // Tue start still counts that week
    expect(weeksSpanned("2026-11-02", "2026-12-18")).toBe(7);
    expect(weeksSpanned("2027-02-22", "2027-03-25")).toBe(5);
  });
  it("a range crossing a Monday is two weeks even if it is seven days", () => {
    expect(weeksSpanned("2026-09-02", "2026-09-08")).toBe(2);
    expect(weeksSpanned("2026-09-07", "2026-09-07")).toBe(1);
  });
});

describe("breakAfterTerm", () => {
  it("finds the half term after the first autumn term", () => {
    expect(breakAfterTerm(TERMS[0], HOLIDAYS)).toEqual({
      name: "Autumn half term",
      start_date: "2026-10-26",
      end_date: "2026-10-30",
    });
  });
  it("chains a bank holiday weekend into the Easter holidays as one break, named after the holiday", () => {
    expect(breakAfterTerm(TERMS[3], HOLIDAYS)).toEqual({
      name: "Spring holiday (Easter)",
      start_date: "2027-03-26",
      end_date: "2027-04-09",
    });
  });
  it("ignores a bank holiday inside the term", () => {
    expect(breakAfterTerm(TERMS[4], HOLIDAYS)).toEqual({
      name: "Summer half term",
      start_date: "2027-05-31",
      end_date: "2027-06-04",
    });
  });
  it("is null when nothing follows the term", () => {
    expect(breakAfterTerm(TERMS[5], HOLIDAYS.filter((h) => h.holiday_type !== "summer"))).toBeNull();
  });
});

describe("buildYearRows", () => {
  const rows = buildYearRows(TERMS, HOLIDAYS, "2026-09-05");

  it("lists terms, breaks and bank holidays in date order", () => {
    expect(rows.map((r) => r.name)).toEqual([
      "Autumn, term 1",
      "Autumn half term",
      "Autumn, term 2",
      "Winter holiday (Christmas)",
      "Spring, term 3",
      "Spring half term",
      "Spring, term 4",
      "Easter bank holiday",
      "Spring holiday (Easter)",
      "Summer, term 5",
      "Early May bank holiday",
      "Summer half term",
      "Summer, term 6",
      "Summer holiday",
    ]);
  });

  it("flags the term we are in and nothing else", () => {
    expect(rows.filter((r) => r.current).map((r) => r.name)).toEqual(["Autumn, term 1"]);
    expect(rows.some((r) => r.past)).toBe(false);
  });

  it("tells parents when classes come back after each school break", () => {
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Autumn half term"].backOn).toBe("2026-11-02");
    expect(byName["Winter holiday (Christmas)"].backOn).toBe("2027-01-04");
    expect(byName["Summer holiday"].backOn).toBeNull();
    // A bank holiday inside a term does not promise a return date weeks away.
    expect(byName["Early May bank holiday"].kind).toBe("bank_holiday");
    expect(byName["Early May bank holiday"].backOn).toBeNull();
  });

  it("gives terms their week count and breaks none", () => {
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(byName["Autumn, term 1"].weeks).toBe(8);
    expect(byName["Autumn half term"].weeks).toBeNull();
  });

  it("drops last year's rows and marks finished ones as past", () => {
    const later = buildYearRows(
      [{ name: "Summer, term 6 (2026)", start_date: "2026-06-08", end_date: "2026-07-22" }, ...TERMS],
      HOLIDAYS,
      "2026-11-05",
    );
    expect(later.some((r) => r.name === "Summer, term 6 (2026)")).toBe(false);
    expect(later.find((r) => r.name === "Autumn, term 1")?.past).toBe(true);
    expect(later.find((r) => r.name === "Autumn, term 2")?.current).toBe(true);
  });
});
