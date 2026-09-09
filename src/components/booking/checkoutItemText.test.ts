import { describe, expect, it } from "vitest";
import { planLine, scheduleLine, summariseDates, CHECKOUT_PLAN_LABEL } from "./checkoutItemText";

const classItem = {
  itemKind: "class" as const,
  dayOfWeek: "monday",
  startTime: "17:00:00",
  endTime: "17:45:00",
  venueName: "Kelvedon Institute",
  pricingPlan: "monthly" as const,
  sessionsCount: null,
  selectedSessionDates: [],
};

describe("scheduleLine", () => {
  it("reads as day · time · venue for a class", () => {
    expect(scheduleLine(classItem)).toBe("Mondays · 5:00–5:45pm · Kelvedon Institute");
  });

  it("drops a missing venue", () => {
    expect(scheduleLine({ ...classItem, venueName: null })).toBe("Mondays · 5:00–5:45pm");
  });

  it("uses the chosen dates for a camp instead of a weekday", () => {
    expect(
      scheduleLine({ ...classItem, itemKind: "camp", dayOfWeek: "tuesday", startTime: "10:00:00", endTime: "15:00:00", selectedSessionDates: ["27 Oct", "28 Oct", "29 Oct"] }),
    ).toBe("27 Oct, 28 Oct, 29 Oct · 10:00am–3:00pm · Kelvedon Institute");
  });

  it("says nothing for a pass (no schedule to speak of)", () => {
    expect(scheduleLine({ ...classItem, itemKind: "pass", startTime: "00:00", endTime: "00:00", venueName: null })).toBe("");
  });

  it("treats legacy items with no itemKind as classes", () => {
    const { itemKind: _k, ...legacy } = classItem;
    expect(scheduleLine(legacy)).toBe("Mondays · 5:00–5:45pm · Kelvedon Institute");
  });
});

describe("planLine", () => {
  it("labels every plan in sentence case", () => {
    expect(CHECKOUT_PLAN_LABEL).toEqual({
      trial: "Trial class",
      session: "Pay as you go",
      monthly: "Monthly membership",
      term: "Pay for the term",
      yearly: "Pay for the year",
      pass: "Class pass",
    });
    expect(planLine(classItem)).toBe("Monthly membership");
  });

  it("adds the trial date", () => {
    expect(planLine({ ...classItem, pricingPlan: "trial", sessionsCount: 1, selectedSessionDates: ["14 Sep"] })).toBe("Trial class · 14 Sep");
  });

  it("adds a count and the dates for pay as you go, trimming long lists", () => {
    expect(
      planLine({ ...classItem, pricingPlan: "session", sessionsCount: 5, selectedSessionDates: ["14 Sep", "21 Sep", "28 Sep", "5 Oct", "12 Oct"] }),
    ).toBe("Pay as you go · 5 classes · 14 Sep, 21 Sep, 28 Sep +2 more");
  });

  it("counts camp days and pass classes", () => {
    expect(planLine({ ...classItem, itemKind: "camp", pricingPlan: "session", sessionsCount: 3, selectedSessionDates: ["27 Oct", "28 Oct", "29 Oct"] })).toBe("Pay as you go · 3 days");
    expect(planLine({ ...classItem, itemKind: "pass", pricingPlan: "pass", sessionsCount: 4 })).toBe("Class pass · 4 classes");
  });
});

describe("summariseDates", () => {
  it("joins up to the limit and counts the rest", () => {
    expect(summariseDates([])).toBe("");
    expect(summariseDates(["1 Sep"])).toBe("1 Sep");
    expect(summariseDates(["1 Sep", "8 Sep", "15 Sep", "22 Sep"])).toBe("1 Sep, 8 Sep, 15 Sep +1 more");
  });
});
