import { describe, expect, it } from "vitest";
import {
  addMonths,
  describePause,
  isoDate,
  pauseBlockedReason,
  planPause,
} from "../../supabase/functions/_shared/membershipPause.ts";
import * as mirror from "./membershipPause";

const d = (s: string) => new Date(s + "T07:00:00.000Z");
const fmt = (iso: string) => iso; // tests compare ISO, the app formats

describe("addMonths", () => {
  it("adds whole months", () => {
    expect(isoDate(addMonths(d("2026-10-05"), 1))).toBe("2026-11-05");
    expect(isoDate(addMonths(d("2026-10-05"), 3))).toBe("2027-01-05");
  });
  it("clamps rather than spilling into the next month", () => {
    expect(isoDate(addMonths(d("2027-01-31"), 1))).toBe("2027-02-28");
    expect(isoDate(addMonths(d("2027-08-31"), 1))).toBe("2027-09-30");
  });
  it("handles a leap February", () => {
    expect(isoDate(addMonths(d("2028-01-31"), 1))).toBe("2028-02-29");
  });
});

describe("planPause — Brooke George, the case this was built for", () => {
  // £110 Unlimited, next payment 5 October. Amie: "pause it for October."
  const plan = planPause(d("2026-10-05"), 1, 110);

  it("skips exactly the October payment", () => {
    expect(plan.skipped).toEqual(["2026-10-05"]);
    expect(plan.skippedTotal).toBe(110);
  });
  it("restarts on the normal November date, at the normal price", () => {
    expect(plan.restartsOn).toBe("2026-11-05");
  });
  it("tells Stripe to resume inside the gap — after October, before November", () => {
    expect(isoDate(plan.resumesAt)).toBe("2026-11-03");
    expect(plan.resumesAt.getTime()).toBeGreaterThan(d("2026-10-05").getTime());
    expect(plan.resumesAt.getTime()).toBeLessThan(d("2026-11-05").getTime());
  });
  it("says so in words", () => {
    expect(describePause(plan, fmt)).toBe(
      "The payment on 2026-10-05 won't be taken. Billing starts again on 2026-11-05.",
    );
  });
});

describe("planPause — longer pauses", () => {
  it("skips several payments and restarts after the last one", () => {
    const plan = planPause(d("2026-10-05"), 3, 27.2);
    expect(plan.skipped).toEqual(["2026-10-05", "2026-11-05", "2026-12-05"]);
    expect(plan.restartsOn).toBe("2027-01-05");
    expect(plan.skippedTotal).toBe(81.6);
    expect(describePause(plan, fmt)).toContain("3 payments won't be taken");
  });
  it("never resumes before the last skipped payment, even across a short month", () => {
    const plan = planPause(d("2027-01-31"), 1, 30);
    expect(plan.skipped).toEqual(["2027-01-31"]);
    expect(plan.restartsOn).toBe("2027-02-28");
    expect(plan.resumesAt.getTime()).toBeGreaterThan(d("2027-01-31").getTime());
    expect(plan.resumesAt.getTime()).toBeLessThan(d("2027-02-28").getTime());
  });
  it("treats a nonsense month count as one month", () => {
    expect(planPause(d("2026-10-05"), 0, 10).skipped).toHaveLength(1);
    expect(planPause(d("2026-10-05"), -4, 10).skipped).toHaveLength(1);
  });
});

describe("pauseBlockedReason", () => {
  const now = d("2026-09-22");
  it("allows a pause when a payment is still ahead", () => {
    expect(pauseBlockedReason(d("2026-10-05"), now, "active")).toBeNull();
    expect(pauseBlockedReason(d("2026-10-05"), now, "past_due")).toBeNull();
  });
  it("refuses once the payment date has arrived", () => {
    expect(pauseBlockedReason(d("2026-09-22"), now, "active")).toMatch(/already due/);
    expect(pauseBlockedReason(d("2026-09-01"), now, "active")).toMatch(/already due/);
  });
  it("refuses a membership that has ended or never started", () => {
    expect(pauseBlockedReason(d("2026-10-05"), now, "cancelled")).toMatch(/already ended/);
    expect(pauseBlockedReason(d("2026-10-05"), now, "incomplete")).toMatch(/hasn't started/);
  });
  it("refuses when there is no payment date at all", () => {
    expect(pauseBlockedReason(null, now, "active")).toMatch(/no upcoming payment/);
  });
});

describe("the client mirror and the server copy", () => {
  // Two copies of this maths exist: one the edge function runs, one the
  // screen runs. If they ever drift, Amie is promised one thing on the button
  // and Stripe is told another.
  const cases: [string, number][] = [
    ["2026-10-05", 1], ["2026-10-05", 3], ["2027-01-31", 1],
    ["2028-01-31", 1], ["2026-12-05", 2], ["2027-08-31", 6],
  ];
  it("agree on every plan", () => {
    for (const [iso, months] of cases) {
      const a = planPause(d(iso), months, 110);
      const b = mirror.planPause(d(iso), months, 110);
      expect({ ...b, resumesAt: b.resumesAt.toISOString() })
        .toEqual({ ...a, resumesAt: a.resumesAt.toISOString() });
    }
  });
  it("agree on what blocks a pause", () => {
    const now = d("2026-09-22");
    for (const [iso] of cases) {
      expect(mirror.pauseBlockedReason(d(iso), now, "active"))
        .toBe(pauseBlockedReason(d(iso), now, "active"));
    }
    expect(mirror.pauseBlockedReason(null, now, "active")).toBe(pauseBlockedReason(null, now, "active"));
  });
});
