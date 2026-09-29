import { describe, it, expect } from "vitest";
import {
  allocate, feesFromDetails, subscriptionTargets, oneOffTargets, refundTargets, withVenues,
  type Allocation,
} from "./paymentAllocation";

const total = (rows: Allocation[], k: keyof Allocation) =>
  rows.reduce((a, r) => a + (r[k] as number), 0);

// Brooke George's family: seven memberships on ONE subscription, the £110 cap split unevenly by
// Stripe — including two at £0.00. These are the real amounts from live.
const brooke = [26.35, 0, 26.35, 30.6, 0.35, 0, 26.35].map((_, i) => ({
  stripeSubscriptionItemId: `si_${i}`,
  classId: `class_${i}`,
  studentId: "brooke",
}));

describe("feesFromDetails", () => {
  it("separates the Nullshift 1% from Stripe's own costs", () => {
    expect(feesFromDetails([
      { type: "stripe_fee", amount: 185 },
      { type: "application_fee", amount: 110 },
    ])).toEqual({ stripeFeePence: 185, platformFeePence: 110 });
  });
  it("counts tax and pass-through network fees as Stripe's, not ours", () => {
    expect(feesFromDetails([
      { type: "stripe_fee", amount: 100 },
      { type: "tax", amount: 20 },
      { type: "payment_method_passthrough_fee", amount: 3 },
      { type: "application_fee", amount: 50 },
    ])).toEqual({ stripeFeePence: 123, platformFeePence: 50 });
  });
  it("handles none", () => {
    expect(feesFromDetails(null)).toEqual({ stripeFeePence: 0, platformFeePence: 0 });
  });
});

describe("membership invoices — split evenly", () => {
  const lines = brooke.map((m) => ({ subscriptionItemId: m.stripeSubscriptionItemId }));
  const targets = subscriptionTargets(lines, brooke);

  it("gives every class on the invoice a share, including the £0 ones", () => {
    expect(targets).toHaveLength(7);
    expect(targets.every((t) => t.weight === 1 && t.kind === "membership")).toBe(true);
  });

  it("splits £110 across seven classes to the penny, with no class at zero", () => {
    const rows = allocate({ grossPence: 11000, stripeFeePence: 185, platformFeePence: 110 }, targets);
    expect(total(rows, "grossPence")).toBe(11000);
    expect(total(rows, "stripeFeePence")).toBe(185);
    expect(total(rows, "platformFeePence")).toBe(110);
    expect(total(rows, "netPence")).toBe(11000 - 185 - 110);
    expect(rows.every((r) => r.grossPence >= 1571 && r.grossPence <= 1572)).toBe(true);
  });

  it("four classes on the cap is exactly £27.50 each", () => {
    const four = subscriptionTargets(
      brooke.slice(0, 4).map((m) => ({ subscriptionItemId: m.stripeSubscriptionItemId })),
      brooke,
    );
    const rows = allocate({ grossPence: 11000, stripeFeePence: 0, platformFeePence: 0 }, four);
    expect(rows.map((r) => r.grossPence)).toEqual([2750, 2750, 2750, 2750]);
  });

  it("never gives a class a negative fee — the bug that splitPence exists to prevent", () => {
    const rows = allocate({ grossPence: 35, stripeFeePence: 5, platformFeePence: 0 }, targets);
    expect(rows.every((r) => r.stripeFeePence >= 0)).toBe(true);
    expect(total(rows, "stripeFeePence")).toBe(5);
  });

  it("does not turn an adjustment line into a class", () => {
    const withAdjustment = [...lines, { subscriptionItemId: null }];
    expect(subscriptionTargets(withAdjustment, brooke)).toHaveLength(7);
  });

  it("counts a class once even if Stripe lists it on two lines (a proration)", () => {
    const dup = [...lines, { subscriptionItemId: "si_0" }];
    expect(subscriptionTargets(dup, brooke)).toHaveLength(7);
  });

  it("ignores a subscription item it has no membership for", () => {
    expect(subscriptionTargets([{ subscriptionItemId: "si_unknown" }], brooke)).toEqual([]);
  });
});

describe("one-off checkouts — split by what each item cost", () => {
  it("weights by price, and files a pass with no class", () => {
    const targets = oneOffTargets([
      { kind: "class", classId: "hiphop", studentId: "evie", totalPrice: 12 },
      { kind: "camp", campId: "summer", studentId: "jack", totalPrice: 60 },
      { kind: "pass", studentId: "evie", totalPrice: 48 },
    ]);
    expect(targets.map((t) => t.kind)).toEqual(["class", "camp", "pass"]);
    expect(targets[2].classId).toBeNull();
    const rows = allocate({ grossPence: 12000, stripeFeePence: 200, platformFeePence: 120 }, targets);
    expect(rows.map((r) => r.grossPence)).toEqual([1200, 6000, 4800]);
    expect(total(rows, "stripeFeePence")).toBe(200);
  });

  it("uses the amount Stripe actually took, even after a coupon", () => {
    // Cart said £60 total; a £10 coupon means Stripe took £50. The ledger reports £50.
    const targets = oneOffTargets([
      { kind: "class", classId: "a", totalPrice: 30 },
      { kind: "class", classId: "b", totalPrice: 30 },
    ]);
    const rows = allocate({ grossPence: 5000, stripeFeePence: 0, platformFeePence: 0 }, targets);
    expect(rows.map((r) => r.grossPence)).toEqual([2500, 2500]);
  });
});

describe("unmatched money", () => {
  it("becomes one explicit unknown row rather than vanishing", () => {
    const rows = allocate({ grossPence: 1500, stripeFeePence: 30, platformFeePence: 15 }, []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "unknown", classId: null, venueId: null, grossPence: 1500, netPence: 1455 });
  });
});

describe("refunds", () => {
  it("come back off the same classes, in the same proportions", () => {
    const charge = allocate(
      { grossPence: 12000, stripeFeePence: 0, platformFeePence: 0 },
      oneOffTargets([
        { kind: "class", classId: "a", totalPrice: 30 },
        { kind: "class", classId: "b", totalPrice: 90 },
      ]),
    );
    const refund = allocate({ grossPence: -12000, stripeFeePence: 0, platformFeePence: 0 }, refundTargets(charge));
    expect(refund.map((r) => [r.classId, r.grossPence])).toEqual([["a", -3000], ["b", -9000]]);
  });

  it("a partial refund is spread proportionally too", () => {
    const charge = allocate({ grossPence: 11000, stripeFeePence: 0, platformFeePence: 0 },
      subscriptionTargets(brooke.slice(0, 4).map((m) => ({ subscriptionItemId: m.stripeSubscriptionItemId })), brooke));
    const refund = allocate({ grossPence: -1200, stripeFeePence: 0, platformFeePence: 0 }, refundTargets(charge));
    expect(total(refund, "grossPence")).toBe(-1200);
    expect(refund.map((r) => r.grossPence)).toEqual([-300, -300, -300, -300]);
  });
});

describe("withVenues", () => {
  it("fills in venues from classes and camps, and leaves a pass without one", () => {
    const t = withVenues(
      oneOffTargets([
        { kind: "class", classId: "hiphop", totalPrice: 12 },
        { kind: "camp", campId: "summer", totalPrice: 60 },
        { kind: "pass", totalPrice: 48 },
      ]),
      new Map([["hiphop", "clacton"]]),
      new Map([["summer", "harrow"]]),
    );
    expect(t.map((x) => x.venueId)).toEqual(["clacton", "harrow", null]);
  });
});

describe("the client mirror and the server copy", () => {
  it("allocate identically", async () => {
    const server = await import("../../supabase/functions/_shared/paymentAllocation.ts");
    const lines = brooke.map((m) => ({ subscriptionItemId: m.stripeSubscriptionItemId }));
    const a = { grossPence: 11000, stripeFeePence: 185, platformFeePence: 110 };
    expect(server.allocate(a, server.subscriptionTargets(lines, brooke)))
      .toEqual(allocate(a, subscriptionTargets(lines, brooke)));
    expect(server.feesFromDetails([{ type: "application_fee", amount: 9 }]))
      .toEqual(feesFromDetails([{ type: "application_fee", amount: 9 }]));
  });
});
