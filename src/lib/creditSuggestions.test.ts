import { describe, expect, it } from "vitest";
import { monthValueForClass, round2 } from "./creditSuggestions";
import type { PricedClass } from "./pricing";

const childClass = (overrides: Partial<PricedClass> = {}): PricedClass => ({
  class_type: "children",
  start_time: "17:00",
  end_time: "18:00",
  price_per_session: null,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
  ...overrides,
});

describe("monthValueForClass", () => {
  it("takes four sessions' worth of the term price", () => {
    expect(monthValueForClass(childClass({ price_per_term: 91 }), 13)).toEqual({
      amount: 28,
      explanation: "4 of the 13 sessions in a £91 term",
    });
    expect(monthValueForClass(childClass({ price_per_term: 104 }), 13)).toEqual({
      amount: 32,
      explanation: "4 of the 13 sessions in a £104 term",
    });
  });

  it("rounds to the penny", () => {
    // 4/13 of £100 = £30.769…
    expect(monthValueForClass(childClass({ price_per_term: 100 }), 13).amount).toBe(30.77);
    // 4/12 of £107.50 = £35.833…
    const { amount, explanation } = monthValueForClass(childClass({ price_per_term: 107.5 }), 12);
    expect(amount).toBe(35.83);
    expect(explanation).toBe("4 of the 12 sessions in a £107.50 term");
  });

  it("falls back to the monthly rate when the class has no term price", () => {
    // 60-minute children's class: £9/week × 3.4 = £30.60
    expect(monthValueForClass(childClass(), 13)).toEqual({
      amount: 30.6,
      explanation: "the monthly rate for this class",
    });
    // An explicit monthly price wins over the computed one.
    expect(monthValueForClass(childClass({ price_per_month: 27.2 }), 13).amount).toBe(27.2);
  });

  it("falls back to the monthly rate when there are no sessions to divide by", () => {
    expect(monthValueForClass(childClass({ price_per_term: 104 }), 0)).toEqual({
      amount: 30.6,
      explanation: "the monthly rate for this class",
    });
  });
});

describe("round2", () => {
  it("rounds to two decimal places", () => {
    expect(round2(30.769)).toBe(30.77);
    expect(round2(35.8333)).toBe(35.83);
    expect(round2(28)).toBe(28);
  });
});
