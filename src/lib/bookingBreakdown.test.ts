import { describe, expect, it } from "vitest";
import {
  derivePriceBreakdown,
  paymentRefOf,
  refundNoteOf,
  sessionDateOf,
} from "./bookingBreakdown";
import type { PricedClass } from "./pricing";

// Disco Dance Tuesdays — the real class behind the Dawson family question.
const DISCO: PricedClass = {
  class_type: "children",
  start_time: "18:00:00",
  end_time: "19:00:00",
  price_per_session: 9,
  price_per_term: 119.7,
  price_per_month: null,
  price_per_year: null,
};

// A 60-minute class with no admin prices — everything derived (£9/wk).
const DERIVED: PricedClass = {
  class_type: "children",
  start_time: "17:00:00",
  end_time: "18:00:00",
  price_per_session: null,
  price_per_term: null,
  price_per_month: null,
  price_per_year: null,
};

const linesOf = (b: ReturnType<typeof derivePriceBreakdown>) =>
  b.lines.map((l) => `${l.kind}:${l.label}${l.amount != null ? `=${l.amount}` : ""}`);

describe("derivePriceBreakdown", () => {
  it("explains the full-price sibling's termly booking (Isabella, £119.70)", () => {
    const b = derivePriceBreakdown("term", 119.7, DISCO, 15);
    expect(b.reconciled).toBe(true);
    expect(b.lines[0]).toMatchObject({ label: "Termly price (set by the studio)", amount: 119.7, kind: "base" });
    expect(b.lines[1].label).toBe("No discount applied");
  });

  it("itemises the sibling discount on the second child (Amelia, £107.73)", () => {
    const b = derivePriceBreakdown("term", 107.73, DISCO, 15);
    expect(b.reconciled).toBe(true);
    expect(b.lines[1]).toMatchObject({ label: "Sibling discount (10%)", amount: -11.97, kind: "discount" });
    expect(b.lines[2]).toMatchObject({ label: "Paid", amount: 107.73, kind: "total" });
  });

  it("derives a termly base from session count when no price is set", () => {
    // £9 × 14 × 0.95 = £119.70
    const b = derivePriceBreakdown("term", 119.7, DERIVED, 14);
    expect(b.reconciled).toBe(true);
    expect(b.lines[0].label).toContain("× 14 sessions");
  });

  it("recognises a sibling-discounted trial (£9 → £8.10)", () => {
    const b = derivePriceBreakdown("trial", 8.1, DERIVED, 1);
    expect(b.reconciled).toBe(true);
    expect(b.lines[1].kind).toBe("discount");
  });

  it("recognises the standard and additional-class monthly rates", () => {
    expect(derivePriceBreakdown("monthly", 30.6, DERIVED, 0).reconciled).toBe(true);
    const additional = derivePriceBreakdown("monthly", 26.35, DERIVED, 0);
    expect(additional.reconciled).toBe(true);
    expect(additional.lines[0].label).toContain("additional-class");
  });

  it("explains a £0 monthly as the £110 Unlimited cap", () => {
    const b = derivePriceBreakdown("monthly", 0, DERIVED, 0);
    expect(b.reconciled).toBe(true);
    expect(b.lines[0].label).toContain("£110 Unlimited");
  });

  it("never invents a discount it can't reconcile", () => {
    const b = derivePriceBreakdown("term", 99.99, DISCO, 15);
    expect(b.reconciled).toBe(false);
    expect(linesOf(b).join(" ")).not.toContain("Sibling");
    expect(b.lines.some((l) => l.label.includes("Doesn't match"))).toBe(true);
  });
});

describe("notes parsing", () => {
  it("pulls the Stripe reference, session date and refund marker", () => {
    expect(paymentRefOf("Stripe PaymentIntent: pi_3U8l7oCcuURED2Xm00pjyW0k")).toBe("pi_3U8l7oCcuURED2Xm00pjyW0k");
    expect(sessionDateOf("Stripe PaymentIntent: pi_abc | session 2026-09-08")).toBe("2026-09-08");
    expect(refundNoteOf("pi_abc | refunded £12.00 on 3 Sep")).toContain("refunded £12.00");
    expect(paymentRefOf("Added by admin")).toBeNull();
    expect(refundNoteOf(null)).toBeNull();
  });
});
