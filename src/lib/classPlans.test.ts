import { describe, expect, it } from "vitest";
import { defaultChildPlan, offersMonthly, offersTermly, offersYearly } from "./classPlans";

describe("plan flags", () => {
  it("treats missing flags as offered, so old classes behave as before", () => {
    expect(offersMonthly({})).toBe(true);
    expect(offersTermly({ allow_termly: null })).toBe(true);
    expect(offersYearly({ allow_yearly: undefined })).toBe(true);
  });

  it("hides a plan only when the switch is explicitly off", () => {
    expect(offersMonthly({ allow_monthly: false })).toBe(false);
    expect(offersTermly({ allow_termly: false })).toBe(false);
    expect(offersYearly({ allow_yearly: false })).toBe(false);
  });
});

describe("defaultChildPlan", () => {
  it("prefers monthly when it's offered", () => {
    expect(defaultChildPlan({}, true)).toBe("monthly");
  });

  it("falls to termly on a termly-only class", () => {
    expect(defaultChildPlan({ allow_monthly: false, allow_yearly: false }, true)).toBe("term");
  });

  it("skips termly when there are no sessions to sell this term", () => {
    expect(defaultChildPlan({ allow_monthly: false }, false)).toBe("yearly");
  });

  it("falls to yearly when it's the only plan on", () => {
    expect(defaultChildPlan({ allow_monthly: false, allow_termly: false }, true)).toBe("yearly");
  });

  it("still lands on a plan even when everything is switched off", () => {
    // The admin UI never allows all three off; this is a belt-and-braces path.
    expect(defaultChildPlan({ allow_monthly: false, allow_termly: false, allow_yearly: false }, true)).toBe("monthly");
  });
});
