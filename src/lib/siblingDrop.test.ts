import { describe, expect, it } from "vitest";
import {
  childrenStillDancing,
  discountedPrice,
  planSiblingDiscountDrop,
  readItemPrice,
  type FamilyBooking,
  type FamilyMembership,
} from "./siblingDrop";

// Today's published prices: 60-min £30.60 (additional £26.35), 45-min £27.20 (additional £22.95).
const SIXTY = { fullMonthly: 30.6, additionalMonthly: 26.35 };
const FORTY_FIVE = { fullMonthly: 27.2, additionalMonthly: 22.95 };

let n = 0;
const m = (studentId: string, monthlyAmount: number, extra: Partial<FamilyMembership> = {}): FamilyMembership => ({
  id: `m${++n}`,
  studentId,
  isSelfStudent: false,
  classId: `c-${studentId}-${n}`,
  classType: "children",
  siblingDiscountEnabled: true,
  ...SIXTY,
  monthlyAmount,
  status: "active",
  ...extra,
});

describe("discountedPrice", () => {
  it("rounds exactly as checkout does", () => {
    expect(discountedPrice(30.6)).toBe(27.54);
    expect(discountedPrice(27.2)).toBe(24.48);
    expect(discountedPrice(26.35)).toBe(23.71); // 2.635 rounds up, as it did at checkout
  });
});

describe("readItemPrice", () => {
  it("reads full and discounted prices against every rate the class can carry", () => {
    expect(readItemPrice(m("a", 30.6), null)).toEqual({ state: "full", base: 30.6 });
    expect(readItemPrice(m("a", 23.71), null)).toEqual({ state: "discounted", base: 26.35 });
    expect(readItemPrice(m("a", 25.0), null)).toEqual({ state: "unknown", base: null });
  });
});

describe("planSiblingDiscountDrop", () => {
  it("THE CASE: the full-price child leaves, so the only child left goes back to full price", () => {
    const plan = planSiblingDiscountDrop([m("brooke", 27.54)], []);
    expect(plan.raises).toEqual([{ membershipId: expect.any(String), studentId: "brooke", from: 27.54, to: 30.6 }]);
    expect(plan.unclear).toEqual([]);
  });

  it("changes nothing when the child who left was the discounted one", () => {
    const plan = planSiblingDiscountDrop([m("alfie", 30.6)], []);
    expect(plan.raises).toEqual([]);
    expect(plan.reason).toMatch(/already pays full price/);
  });

  it("raises every class of a child who does two, whichever order they were booked in", () => {
    // Booked 45-min first (full) then 60-min (additional): £27.20 + £26.35, both discounted.
    const plan = planSiblingDiscountDrop(
      [m("evie", 24.48, FORTY_FIVE), m("evie", 23.71)],
      [],
    );
    expect(plan.raises.map((r) => [r.from, r.to])).toEqual([[24.48, 27.2], [23.71, 26.35]]);
  });

  it("with three children, makes only the highest-spending remaining child full price", () => {
    const plan = planSiblingDiscountDrop(
      [m("bea", 27.54), m("bea", 23.71), m("cal", 27.54)],
      [],
    );
    expect(new Set(plan.raises.map((r) => r.studentId))).toEqual(new Set(["bea"]));
    expect(plan.raises).toHaveLength(2);
  });

  it("never leaves two full-price children: if one already pays full, nobody else changes", () => {
    const plan = planSiblingDiscountDrop([m("amy", 30.6), m("bea", 27.54)], []);
    expect(plan.raises).toEqual([]);
  });

  it("keeps the discount while a brother or sister is still dancing some other way", () => {
    expect(planSiblingDiscountDrop([m("brooke", 27.54)], ["alfie"]).raises).toEqual([]);
  });

  it("counts a child whose only class has the sibling discount switched off", () => {
    const plan = planSiblingDiscountDrop(
      [m("brooke", 27.54), m("alfie", 30.6, { siblingDiscountEnabled: false })],
      [],
    );
    expect(plan.raises).toEqual([]);
  });

  it("never touches a price it can't read, and says so", () => {
    const plan = planSiblingDiscountDrop([m("brooke", 25.0)], []);
    expect(plan.raises).toEqual([]);
    expect(plan.unclear).toEqual([{ membershipId: expect.any(String), studentId: "brooke", amount: 25 }]);
  });

  it("won't guess when a remaining child's price is unreadable — it could be the full-price one", () => {
    const plan = planSiblingDiscountDrop([m("bea", 27.54), m("cal", 29.0)], []);
    expect(plan.raises).toEqual([]);
    expect(plan.unclear.map((u) => u.studentId)).toEqual(["cal"]);
  });

  it("leaves a membership that is itself ending at its final price", () => {
    const plan = planSiblingDiscountDrop([m("brooke", 27.54, { status: "cancel_scheduled" })], []);
    expect(plan.raises).toEqual([]);
    expect(plan.reason).toMatch(/ending too/);
  });

  it("raises a paused or overdue membership too — the new price applies when it next bills", () => {
    expect(planSiblingDiscountDrop([m("brooke", 27.54, { status: "paused" })], []).raises).toHaveLength(1);
    expect(planSiblingDiscountDrop([m("brooke", 27.54, { status: "past_due" })], []).raises).toHaveLength(1);
  });

  it("ignores classes free under the £110 cap, and adults' own memberships", () => {
    const plan = planSiblingDiscountDrop(
      [m("brooke", 27.54), m("brooke", 0), m("mum", 27.54, { isSelfStudent: true })],
      [],
    );
    expect(plan.raises.map((r) => r.to)).toEqual([30.6]);
  });

  it("does nothing for a family with no children left", () => {
    expect(planSiblingDiscountDrop([], []).raises).toEqual([]);
  });
});

describe("childrenStillDancing", () => {
  const b = (studentId: string, bookingType: string, extra: Partial<FamilyBooking> = {}): FamilyBooking => ({
    studentId, isSelfStudent: false, bookingType, status: "confirmed", notes: null,
    classTermEnd: null, campEndDate: null, ...extra,
  });
  const TODAY = "2026-10-03";

  it("counts nights, terms and camps still to come — and nothing that has finished", () => {
    const ids = childrenStillDancing([
      b("a", "session", { notes: "Stripe PaymentIntent: pi_x | session 2026-10-10" }),
      b("b", "trial", { notes: "Trial — session 2026-09-01" }),
      b("c", "term", { classTermEnd: "2026-12-18" }),
      b("d", "yearly", { classTermEnd: "2026-07-20" }),
      b("e", "camp", { campEndDate: "2026-10-30" }),
      b("f", "pass", { notes: "Class pass x — session 2026-10-03" }),
    ], TODAY);
    expect(ids.sort()).toEqual(["a", "c", "e", "f"]);
  });

  it("ignores monthly bookings, cancelled bookings and the parent's own", () => {
    expect(childrenStillDancing([
      b("a", "monthly"),
      b("b", "term", { classTermEnd: "2026-12-18", status: "cancelled" }),
      b("c", "term", { classTermEnd: "2026-12-18", isSelfStudent: true }),
    ], TODAY)).toEqual([]);
  });
});

describe("the client mirror and the server copy", () => {
  it("decide identically", async () => {
    const server = await import("../../supabase/functions/_shared/siblingDrop.ts");
    const families: FamilyMembership[][] = [
      [m("brooke", 27.54)],
      [m("evie", 24.48, FORTY_FIVE), m("evie", 23.71)],
      [m("bea", 27.54), m("bea", 23.71), m("cal", 27.54)],
      [m("amy", 30.6), m("bea", 27.54)],
      [m("bea", 27.54), m("cal", 29.0)],
    ];
    for (const f of families) {
      expect(server.planSiblingDiscountDrop(f, [])).toEqual(planSiblingDiscountDrop(f, []));
    }
  });
});
