import { describe, expect, it } from "vitest";
import {
  ADULT_PASSES,
  additionalMonthlyPrice,
  computeSiblingDiscount,
  durationMinutes,
  monthlyPrice,
  priceMonthlyItems,
  sessionPrice,
  termPrice,
  trialPrice,
  yearlyPrice,
  type PricedClass,
} from "./pricing";

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

const adultClass = (overrides: Partial<PricedClass> = {}): PricedClass => ({
  ...childClass({ class_type: "adult" }),
  ...overrides,
});

describe("durationMinutes", () => {
  it("computes 45 and 60 minute classes", () => {
    expect(durationMinutes("17:00", "17:45")).toBe(45);
    expect(durationMinutes("17:00:00", "18:00:00")).toBe(60);
    expect(durationMinutes(null, "18:00")).toBeNull();
    expect(durationMinutes("18:00", "18:00")).toBeNull();
  });
});

describe("children's pricing (Amie's document)", () => {
  it("prices a single 60-minute class at £9 and 45-minute at £8", () => {
    expect(sessionPrice(childClass())).toBe(9);
    expect(sessionPrice(childClass({ end_time: "17:45" }))).toBe(8);
  });

  it("charges the trial at the price of one class", () => {
    expect(trialPrice(childClass())).toBe(9);
    expect(trialPrice(childClass({ end_time: "17:45" }))).toBe(8);
  });

  it("derives the published monthly membership prices (£30.60 / £27.20)", () => {
    expect(monthlyPrice(childClass())).toBe(30.6);
    expect(monthlyPrice(childClass({ end_time: "17:45" }))).toBe(27.2);
  });

  it("prices additional weekly classes at £7.75 / £6.75 per week (£26.35 / £22.95 monthly)", () => {
    expect(additionalMonthlyPrice(childClass())).toBe(26.35);
    expect(additionalMonthlyPrice(childClass({ end_time: "17:45" }))).toBe(22.95);
  });

  it("gives 10% off yearly upfront (best deal) over 38 dance weeks", () => {
    // £9 × 38 × 0.9 = £307.80
    expect(yearlyPrice(childClass())).toBe(307.8);
  });

  it("gives 5% off the termly upfront price", () => {
    // £9 × 12 sessions × 0.95 = £102.60
    expect(termPrice(childClass(), 12)).toBe(102.6);
    expect(termPrice(childClass(), 0)).toBeNull();
  });

  it("prefers admin-set prices over derived defaults", () => {
    const cls = childClass({
      price_per_session: 10,
      price_per_month: 35,
      price_per_year: 320,
      price_per_term: 99,
    });
    expect(sessionPrice(cls)).toBe(10);
    expect(monthlyPrice(cls)).toBe(35);
    expect(yearlyPrice(cls)).toBe(320);
    expect(termPrice(cls, 12)).toBe(99);
  });
});

describe("adult pricing (Amie's document)", () => {
  it("prices PAYG 60-minute at £10 and 75-minute at £12", () => {
    expect(sessionPrice(adultClass())).toBe(10);
    expect(sessionPrice(adultClass({ end_time: "18:15" }))).toBe(12);
  });

  it("has the published multi-class passes", () => {
    expect(ADULT_PASSES.week_2).toMatchObject({ sessions: 2, price: 20, windowDays: null });
    expect(ADULT_PASSES.pack_4).toMatchObject({ sessions: 4, price: 40, windowDays: 42 });
    expect(ADULT_PASSES.pack_6).toMatchObject({ sessions: 6, price: 55, windowDays: 42 });
    expect(ADULT_PASSES.pack_8).toMatchObject({ sessions: 8, price: 70, windowDays: 42 });
  });
});

describe("priceMonthlyItems", () => {
  it("charges the first class full and additional classes at the lower rate", () => {
    const prices = priceMonthlyItems([
      { id: "a", classId: "cls-a", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
      { id: "b", classId: "cls-b", studentId: "child1", fullMonthly: 27.2, additionalMonthly: 22.95 },
    ]);
    expect(prices.get("a")).toBe(30.6); // most expensive is full price
    expect(prices.get("b")).toBe(22.95); // 45-min additional rate
  });

  it("treats different children independently", () => {
    const prices = priceMonthlyItems([
      { id: "a", classId: "cls-a", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
      { id: "b", classId: "cls-b", studentId: "child2", fullMonthly: 30.6, additionalMonthly: 26.35 },
    ]);
    expect(prices.get("a")).toBe(30.6);
    expect(prices.get("b")).toBe(30.6);
  });

  it("caps a child's combined monthly total at the £110 Unlimited price", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => ({
      id,
      classId: `cls-${id}`,
      studentId: "child1",
      fullMonthly: 30.6,
      additionalMonthly: 26.35,
    }));
    const prices = priceMonthlyItems(items);
    const total = [...prices.values()].reduce((sum, p) => sum + p, 0);
    // 30.60 + 26.35×3 = 109.65, then the 5th class only costs the 35p to the cap
    expect(Math.round(total * 100) / 100).toBe(110);
  });

  it("breaks equal-price ties on classId, not the volatile cart id, so client and server agree", () => {
    // Two equal-priced 60-min classes for one child. The result must depend
    // only on classId ordering — the cart `id` (which differs client vs server)
    // must not change which item is charged full vs additional.
    const clientOrder = priceMonthlyItems([
      { id: "cartA-late", classId: "cls-1", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
      { id: "cartB-early", classId: "cls-2", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
    ]);
    const serverOrder = priceMonthlyItems([
      { id: "0", classId: "cls-1", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
      { id: "1", classId: "cls-2", studentId: "child1", fullMonthly: 30.6, additionalMonthly: 26.35 },
    ]);
    // cls-1 sorts before cls-2, so cls-1 gets full price on both sides.
    expect(clientOrder.get("cartA-late")).toBe(30.6);
    expect(clientOrder.get("cartB-early")).toBe(26.35);
    expect(serverOrder.get("0")).toBe(30.6);
    expect(serverOrder.get("1")).toBe(26.35);
  });
});

describe("computeSiblingDiscount", () => {
  const item = (
    id: string,
    studentId: string,
    totalPrice: number,
    overrides: Partial<Parameters<typeof computeSiblingDiscount>[0][number]> = {},
  ) => ({
    id,
    studentId,
    isSelfStudent: false,
    classType: "children" as const,
    siblingDiscountEnabled: true,
    totalPrice,
    ...overrides,
  });

  it("gives no discount for a single child", () => {
    const result = computeSiblingDiscount([item("a", "child1", 30.6)]);
    expect(result.total).toBe(0);
    expect(result.discountedChildIds).toEqual([]);
  });

  it("gives 10% to the second child (lower-spending child discounted)", () => {
    const result = computeSiblingDiscount([
      item("a", "child1", 30.6),
      item("b", "child2", 27.2),
    ]);
    expect(result.total).toBe(2.72);
    expect(result.perItem.get("b")).toBe(2.72);
    expect(result.perItem.has("a")).toBe(false);
    expect(result.discountedChildIds).toEqual(["child2"]);
  });

  it("discounts the third child and beyond too", () => {
    const result = computeSiblingDiscount([
      item("a", "child1", 100),
      item("b", "child2", 50),
      item("c", "child3", 40),
    ]);
    expect(result.total).toBe(9);
    expect(result.discountedChildIds.sort()).toEqual(["child2", "child3"]);
  });

  it("discounts every basket child when another sibling already has a booking", () => {
    const result = computeSiblingDiscount(
      [item("a", "child1", 30.6)],
      ["existing-child"],
    );
    expect(result.total).toBe(3.06);
    expect(result.discountedChildIds).toEqual(["child1"]);
  });

  it("does not double-count a prior booking by a child who is in the basket", () => {
    const result = computeSiblingDiscount([item("a", "child1", 30.6)], ["child1"]);
    expect(result.total).toBe(0);
  });

  it("never discounts adult items", () => {
    const result = computeSiblingDiscount([
      item("a", "child1", 30.6),
      item("b", "self1", 10, { classType: "adult" }),
      item("c", "child2", 27.2),
    ]);
    expect(result.perItem.has("b")).toBe(false);
    expect(result.total).toBe(2.72);
  });

  it("skips self (account-holder) attendees", () => {
    const result = computeSiblingDiscount([
      item("a", "self1", 30.6, { isSelfStudent: true }),
      item("b", "child1", 27.2),
    ]);
    expect(result.total).toBe(0);
  });

  it("respects the per-class sibling toggle", () => {
    const result = computeSiblingDiscount([
      item("a", "child1", 30.6),
      item("b", "child2", 27.2, { siblingDiscountEnabled: false }),
    ]);
    expect(result.total).toBe(0);
  });
});
