import { describe, it, expect } from "vitest";
// Pure shared module used by the Stripe edge functions (no Deno APIs).
import {
  DEFAULT_PLATFORM_FEE_PERCENT,
  platformFeePence,
} from "../../supabase/functions/_shared/platformFee";

describe("platformFeePence (Nullshift 1% booking fee)", () => {
  it("defaults to 1%", () => {
    expect(DEFAULT_PLATFORM_FEE_PERCENT).toBe(1);
    expect(platformFeePence(900)).toBe(9); // £9.00 booking → 9p
    expect(platformFeePence(10000)).toBe(100); // £100.00 → £1.00
  });

  it("rounds to the nearest penny", () => {
    expect(platformFeePence(1250)).toBe(13); // £12.50 → 12.5p → 13p
    expect(platformFeePence(1249)).toBe(12); // 12.49p → 12p
  });

  it("never returns 0 for a charged amount (Stripe rejects a 0 application fee)", () => {
    expect(platformFeePence(30)).toBe(1); // £0.30 minimum charge → 1p floor
  });

  it("returns 0 for zero/invalid amounts or a 0% fee", () => {
    expect(platformFeePence(0)).toBe(0);
    expect(platformFeePence(-100)).toBe(0);
    expect(platformFeePence(NaN)).toBe(0);
    expect(platformFeePence(10000, 0)).toBe(0);
  });

  it("honours a custom percentage", () => {
    expect(platformFeePence(10000, 2.5)).toBe(250);
  });
});
