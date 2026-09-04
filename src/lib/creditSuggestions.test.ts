import { describe, it, expect } from "vitest";
import { monthValueForClass, round2 } from "./creditSuggestions";

const cls = (overrides: Record<string, unknown> = {}) => ({
  class_type: "children" as const,
  start_time: "16:30",
  end_time: "17:30",
  price_per_session: null,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
  ...overrides,
});

describe("monthValueForClass", () => {
  it("values a month as four weekly classes at the class's own rate", () => {
    // White Court Performing Arts: £8 a class, £104 a term.
    expect(monthValueForClass(cls({ price_per_session: 8, price_per_term: 104 }))).toEqual({
      amount: 32,
      explanation: "4 weekly classes at £8",
    });
    // White Court Street Dance: £7 a class, £91 a term.
    expect(monthValueForClass(cls({ price_per_session: 7, price_per_term: 91 })).amount).toBe(28);
  });

  it("falls back to the duration-based rate when no per-class price is set", () => {
    // 60-minute children's class defaults to £9 a week.
    expect(monthValueForClass(cls()).amount).toBe(36);
    // 45-minute class defaults to £8 a week.
    expect(monthValueForClass(cls({ end_time: "17:15" })).amount).toBe(32);
  });

  it("mentions a studio-set monthly rate when it differs from four classes", () => {
    const value = monthValueForClass(cls({ price_per_session: 8, price_per_month: 27.2 }));
    expect(value.amount).toBe(32);
    expect(value.explanation).toBe("4 weekly classes at £8 (its monthly membership rate is £27.20)");
  });

  it("rounds to the penny", () => {
    expect(monthValueForClass(cls({ price_per_session: 8.125 })).amount).toBe(32.5);
    expect(round2(1.006)).toBe(1.01);
  });
});
