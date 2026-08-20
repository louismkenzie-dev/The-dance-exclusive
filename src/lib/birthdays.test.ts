import { describe, expect, it } from "vitest";
import { birthdayInWeekOf, weekBoundsOf } from "./birthdays";

describe("weekBoundsOf", () => {
  it("gives the Monday-start week containing the date", () => {
    // 2026-08-20 is a Thursday → week is Mon 17th to Sun 23rd.
    const { start, end } = weekBoundsOf("2026-08-20");
    expect(start.getDate()).toBe(17);
    expect(end.getDate()).toBe(23);
  });

  it("handles a Monday and a Sunday", () => {
    expect(weekBoundsOf("2026-08-17").start.getDate()).toBe(17);
    expect(weekBoundsOf("2026-08-23").start.getDate()).toBe(17);
  });
});

describe("birthdayInWeekOf", () => {
  it("spots a birthday on the exact day", () => {
    expect(birthdayInWeekOf("2016-08-20", "2026-08-20")).toBe("today");
  });

  it("spots a birthday elsewhere in the class week", () => {
    // Class Thursday 20th; birthday Saturday 22nd (same Mon–Sun week).
    expect(birthdayInWeekOf("2015-08-22", "2026-08-20")).toBe("this-week");
    // Birthday the Monday before the Thursday class still counts.
    expect(birthdayInWeekOf("2015-08-17", "2026-08-20")).toBe("this-week");
  });

  it("ignores birthdays outside the week", () => {
    expect(birthdayInWeekOf("2015-08-24", "2026-08-20")).toBe(null);
    expect(birthdayInWeekOf("2015-08-16", "2026-08-20")).toBe(null);
    expect(birthdayInWeekOf("2015-02-20", "2026-08-20")).toBe(null);
  });

  it("handles the new-year week straddle", () => {
    // Week of Thu 1 Jan 2026 runs Mon 29 Dec 2025 → Sun 4 Jan 2026.
    expect(birthdayInWeekOf("2015-12-30", "2026-01-01")).toBe("this-week");
    expect(birthdayInWeekOf("2015-01-03", "2026-01-01")).toBe("this-week");
    expect(birthdayInWeekOf("2015-01-05", "2026-01-01")).toBe(null);
  });

  it("is null without a usable date of birth", () => {
    expect(birthdayInWeekOf(null, "2026-08-20")).toBe(null);
    expect(birthdayInWeekOf("", "2026-08-20")).toBe(null);
    expect(birthdayInWeekOf("not-a-date", "2026-08-20")).toBe(null);
  });
});
