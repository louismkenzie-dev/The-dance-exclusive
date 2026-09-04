import { describe, it, expect } from "vitest";
import {
  allocateDiscount,
  couponKindOf,
  validateAndCompute,
} from "../../supabase/functions/_shared/coupon.ts";

/**
 * Stand-in for the Supabase client covering exactly the calls the coupon
 * engine makes: the coupon lookup, the account email, and the two
 * redemption counts (total = one .eq, per-user = two .eq calls).
 */
function fakeSupabase(opts: {
  coupon?: Record<string, unknown> | null;
  profileEmail?: string | null;
  redemptionsTotal?: number;
  redemptionsUser?: number;
}) {
  const builder = (row: unknown, counts?: { total: number; user: number }) => {
    let eqCalls = 0;
    const b: any = {
      select: () => b,
      in: () => b,
      or: () => b,
      limit: () => b,
      eq: () => { eqCalls += 1; return b; },
      maybeSingle: async () => ({ data: row, error: null }),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve({
          data: row,
          error: null,
          count: counts ? (eqCalls >= 2 ? counts.user : counts.total) : 0,
        }).then(resolve, reject),
    };
    return b;
  };
  return {
    from(table: string) {
      if (table === "coupons") return builder(opts.coupon ?? null);
      if (table === "profiles") return builder(opts.profileEmail == null ? null : { email: opts.profileEmail });
      if (table === "coupon_redemptions") {
        return builder(null, { total: opts.redemptionsTotal ?? 0, user: opts.redemptionsUser ?? 0 });
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

const baseCoupon = {
  id: "c1",
  code: "TDE-ABCD2345",
  is_active: true,
  valid_from: null,
  valid_until: null,
  usage_limit_total: 1,
  usage_limit_per_user: 1,
  discount_type: "fixed",
  discount_value: 7.5,
  applies_to_kinds: ["camp", "class", "monthly", "pass"],
  applies_to_camp_ids: [],
  restricted_to_email: "parent@example.com",
};

const termItem = { classId: "cls", pricingPlan: "term", totalPrice: 104, itemKind: "class" };
const campItem = { classId: "", pricingPlan: "session", totalPrice: 60, itemKind: "camp", campId: "camp1" };

describe("couponKindOf", () => {
  it("maps basket items onto the four coupon kinds", () => {
    expect(couponKindOf({ itemKind: "camp" })).toBe("camp");
    expect(couponKindOf({ itemKind: "pass" })).toBe("pass");
    expect(couponKindOf({ itemKind: "class", pricingPlan: "monthly" })).toBe("monthly");
    expect(couponKindOf({ itemKind: "class", pricingPlan: "term" })).toBe("class");
    expect(couponKindOf({ pricingPlan: "trial" })).toBe("class");
  });
});

describe("allocateDiscount", () => {
  it("takes a fixed amount off the eligible items in basket order", () => {
    expect(allocateDiscount([10400, 9000], [0], 750, "fixed", 7.5)).toEqual([750, 0]);
    expect(allocateDiscount([10400, 9000], [0, 1], 15000, "fixed", 150)).toEqual([10400, 4600]);
    expect(allocateDiscount([10400, 9000], [1], 750, "fixed", 7.5)).toEqual([0, 750]);
  });

  it("splits a percentage across every eligible item and settles rounding", () => {
    expect(allocateDiscount([10400, 9000], [0, 1], 1940, "percent", 10)).toEqual([1040, 900]);
    // 10% of three £3.33 items = 100p, but 33+33+33 = 99 — the remainder lands on the first.
    expect(allocateDiscount([333, 333, 333], [0, 1, 2], 100, "percent", 10)).toEqual([34, 33, 33]);
  });

  it("never takes more off an item than it costs, and gives nothing when there is no discount", () => {
    expect(allocateDiscount([500], [0], 800, "fixed", 8)).toEqual([500]);
    expect(allocateDiscount([500, 500], [], 100, "fixed", 1)).toEqual([0, 0]);
  });
});

describe("validateAndCompute", () => {
  it("only lets the named family use a personal code", async () => {
    const wrong = await validateAndCompute(
      fakeSupabase({ coupon: baseCoupon, profileEmail: "someone@else.com" }),
      "tde-abcd2345",
      "user-1",
      [termItem],
    );
    expect(wrong).toEqual({ error: "This code belongs to a different account" });

    const notSignedIn = await validateAndCompute(
      fakeSupabase({ coupon: baseCoupon, profileEmail: "parent@example.com" }),
      "TDE-ABCD2345",
      "",
      [termItem],
    );
    expect(notSignedIn).toEqual({ error: "Please sign in to use this code" });
  });

  it("takes a personal credit off a termly class booking", async () => {
    const result = await validateAndCompute(
      fakeSupabase({ coupon: baseCoupon, profileEmail: "Parent@Example.com " }),
      "TDE-ABCD2345",
      "user-1",
      [termItem],
    );
    expect(result).toMatchObject({
      couponId: "c1",
      discountAmount: 7.5,
      eligibleSubtotal: 104,
      finalTotal: 96.5,
      eligibleIndexes: [0],
    });
  });

  it("keeps codes made before kinds existed on holiday workshops only", async () => {
    const legacy = { ...baseCoupon, applies_to_kinds: null, restricted_to_email: null };
    const onClass = await validateAndCompute(fakeSupabase({ coupon: legacy }), "TDE-ABCD2345", "user-1", [termItem]);
    expect(onClass).toEqual({
      error: "This code only works on holiday workshops — there's nothing in your basket it covers",
    });
    const onCamp = await validateAndCompute(fakeSupabase({ coupon: legacy }), "TDE-ABCD2345", "user-1", [termItem, campItem]);
    expect(onCamp).toMatchObject({ discountAmount: 7.5, eligibleIndexes: [1] });
  });

  it("covers a new membership's first payment when the code allows monthly", async () => {
    const monthlyOnly = { ...baseCoupon, restricted_to_email: null, applies_to_kinds: ["monthly"], discount_type: "percent", discount_value: 100 };
    const monthlyItem = { classId: "cls", pricingPlan: "monthly", totalPrice: 30.6, itemKind: "class" };
    const result = await validateAndCompute(fakeSupabase({ coupon: monthlyOnly }), "TDE-ABCD2345", "user-1", [monthlyItem, campItem]);
    expect(result).toMatchObject({ discountAmount: 30.6, eligibleIndexes: [0], finalTotal: 60 });
  });

  it("refuses a used-up code and a code that would leave nothing to pay", async () => {
    const used = await validateAndCompute(
      fakeSupabase({ coupon: baseCoupon, profileEmail: "parent@example.com", redemptionsTotal: 1 }),
      "TDE-ABCD2345",
      "user-1",
      [termItem],
    );
    expect(used).toEqual({ error: "This coupon has reached its usage limit" });

    const full = { ...baseCoupon, restricted_to_email: null, discount_value: 104 };
    const nothingToPay = await validateAndCompute(fakeSupabase({ coupon: full }), "TDE-ABCD2345", "user-1", [termItem]);
    expect("error" in nothingToPay && nothingToPay.error).toMatch(/nothing to pay/);
  });
});
