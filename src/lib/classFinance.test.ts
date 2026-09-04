import { describe, it, expect } from "vitest";
// The Stripe edge functions' own fee module — imported here so the report can
// never quietly drift away from what is actually charged.
import {
  DEFAULT_PLATFORM_FEE_PERCENT,
  platformFeePence,
} from "../../supabase/functions/_shared/platformFee";
import {
  DEFAULT_FEE_RATES,
  paymentRefOf,
  platformFeeOf,
  stripeFeeOf,
  summariseByClass,
  totalsOf,
} from "./classFinance";

describe("per-class financial report", () => {
  it("uses the same platform fee the checkout charges", () => {
    expect(DEFAULT_FEE_RATES.platformPercent).toBe(DEFAULT_PLATFORM_FEE_PERCENT);
    for (const amount of [900, 1250, 3060, 11000]) {
      expect(platformFeeOf(amount, DEFAULT_FEE_RATES.platformPercent)).toBe(platformFeePence(amount));
    }
  });

  it("charges Stripe's fixed fee once per payment, not once per booking", () => {
    // £30 in one basket: 1.5% + 20p = 45p + 20p = 65p, platform 1% = 30p.
    const oneBasket = summariseByClass([
      { classId: "a", className: "Street Juniors", paymentRef: "pi_1", amount: 20 },
      { classId: "b", className: "Ballet Minis", paymentRef: "pi_1", amount: 10 },
    ]);
    const totals = totalsOf(oneBasket);
    expect(totals.gross).toBe(30);
    expect(totals.stripeFee).toBe(0.65);
    expect(totals.platformFee).toBe(0.3);
    expect(totals.net).toBe(29.05);

    // The same two bookings paid separately carry the 20p twice.
    const separately = totalsOf(summariseByClass([
      { classId: "a", className: "Street Juniors", paymentRef: "pi_1", amount: 20 },
      { classId: "b", className: "Ballet Minis", paymentRef: "pi_2", amount: 10 },
    ]));
    expect(separately.stripeFee).toBe(0.85);
  });

  it("splits a shared payment's fee across its classes and still adds up", () => {
    const rows = summariseByClass([
      { classId: "a", className: "Street Juniors", paymentRef: "pi_1", amount: 20 },
      { classId: "b", className: "Ballet Minis", paymentRef: "pi_1", amount: 10 },
    ]);
    const street = rows.find((r) => r.classId === "a")!;
    const ballet = rows.find((r) => r.classId === "b")!;
    expect(street.stripeFee + ballet.stripeFee).toBeCloseTo(0.65, 5);
    expect(street.stripeFee).toBeGreaterThan(ballet.stripeFee);
    expect(street.net + ballet.net).toBeCloseTo(29.05, 5);
  });

  it("takes no fee on a free place", () => {
    const rows = summariseByClass([
      { classId: "c", className: "Carnival Workshop", paymentRef: "free_x", amount: 0, free: true },
    ]);
    expect(rows[0]).toMatchObject({ gross: 0, stripeFee: 0, platformFee: 0, net: 0, bookings: 1 });
  });

  it("adds several payments for the same class into one row", () => {
    const rows = summariseByClass([
      { classId: "a", className: "Street Juniors", paymentRef: "pi_1", amount: 20 },
      { classId: "a", className: "Street Juniors", paymentRef: "pi_2", amount: 20 },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ bookings: 2, gross: 40, stripeFee: 1, platformFee: 0.4, net: 38.6 });
  });

  it("treats a booking with no payment reference as its own payment", () => {
    const rows = summariseByClass([
      { classId: "a", className: "Street Juniors", paymentRef: null, amount: 10 },
      { classId: "a", className: "Street Juniors", paymentRef: null, amount: 10 },
    ]);
    expect(rows[0].stripeFee).toBe(0.7); // 2 × (15p + 20p)
  });

  it("reads the payment a booking belongs to from its notes", () => {
    expect(paymentRefOf("Stripe PaymentIntent: pi_3ABC | session 2026-09-10")).toBe("pi_3ABC");
    expect(paymentRefOf("Stripe PaymentIntent: free_a1b2c3d4e5f60718 | session 2026-09-10")).toBe("free_a1b2c3d4e5f60718");
    expect(paymentRefOf("free_a1b2c3d4e5f60718")).toBe("free_a1b2c3d4e5f60718");
    expect(paymentRefOf("Stripe PaymentIntent: sub_XYZ")).toBe("sub_XYZ");
    expect(paymentRefOf("Added by admin")).toBeNull();
    expect(paymentRefOf(null)).toBeNull();
  });

  it("has sensible defaults for UK card processing", () => {
    expect(stripeFeeOf(10000, DEFAULT_FEE_RATES)).toBe(170); // £100 → £1.50 + 20p
    expect(stripeFeeOf(0, DEFAULT_FEE_RATES)).toBe(0);
  });
});
