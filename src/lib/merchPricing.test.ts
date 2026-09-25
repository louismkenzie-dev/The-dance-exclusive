import { describe, it, expect } from "vitest";
import {
  toPence, clampQuantity, unitPricePence, linePence, orderTotalPence, splitBundlePence,
  MAX_QUANTITY,
} from "./merchPricing";

describe("merchPricing", () => {
  describe("toPence", () => {
    it("converts pounds to whole pence", () => {
      expect(toPence(22)).toBe(2200);
      expect(toPence(13.5)).toBe(1350);
      expect(toPence("18.00")).toBe(1800); // numeric columns arrive as strings
    });
    it("treats junk as zero rather than NaN", () => {
      expect(toPence(null)).toBe(0);
      expect(toPence(undefined)).toBe(0);
      expect(toPence("abc")).toBe(0);
    });
    it("does not drift on values that are awkward in binary floating point", () => {
      expect(toPence(0.1 + 0.2)).toBe(30);
      expect(toPence(19.99)).toBe(1999);
      expect(toPence(0.07)).toBe(7);
    });

    it("rounds a half-penny down, which cannot arise from a real price", () => {
      // 1.005 * 100 is 100.49999999999999 in IEEE 754, so this rounds to 100 rather than 101.
      // Documented rather than worked around: prices are held to two decimals, so a half-penny
      // input does not exist. Bending the maths for a value that cannot occur would risk the
      // values that can.
      expect(toPence(1.005)).toBe(100);
    });
  });

  describe("quantity", () => {
    it("clamps to 1..20", () => {
      expect(clampQuantity(0)).toBe(1);
      expect(clampQuantity(-5)).toBe(1);
      expect(clampQuantity(21)).toBe(MAX_QUANTITY);
      expect(clampQuantity(3)).toBe(3);
    });
    it("floors fractions and survives junk", () => {
      expect(clampQuantity(2.9)).toBe(2);
      expect(clampQuantity("abc")).toBe(1);
      expect(clampQuantity(null)).toBe(1);
    });
  });

  describe("unit price", () => {
    const hoodie = { base_price: 22 };
    it("uses the product price by default", () => {
      expect(unitPricePence(hoodie, {})).toBe(2200);
    });
    it("lets a size override it", () => {
      expect(unitPricePence(hoodie, { price_override: 25 })).toBe(2500);
    });
    it("ignores a null override rather than pricing at zero", () => {
      expect(unitPricePence(hoodie, { price_override: null })).toBe(2200);
    });
    it("honours a genuine zero override — a free size is a real thing", () => {
      expect(unitPricePence(hoodie, { price_override: 0 })).toBe(0);
    });
  });

  describe("line totals", () => {
    const hoodie = { base_price: 22 };
    it("is unit x quantity with no personalisation", () => {
      expect(linePence(hoodie, {}, 0, 2)).toBe(4400);
    });
    it("charges personalisation per garment, not per line", () => {
      // two hoodies, each with a £3 name: 2 x (22 + 3)
      expect(linePence(hoodie, {}, 300, 2)).toBe(5000);
    });
    it("adds several placements together", () => {
      // front + back + sleeve at £3 each on one hoodie
      expect(linePence(hoodie, {}, 900, 1)).toBe(3100);
    });
    it("clamps the quantity rather than trusting it", () => {
      expect(linePence(hoodie, {}, 0, 999)).toBe(2200 * MAX_QUANTITY);
    });
    it("never lets a negative personalisation discount the garment", () => {
      expect(linePence(hoodie, {}, -500, 1)).toBe(2200);
    });
  });

  it("sums an order", () => {
    expect(orderTotalPence([2200, 1300, 0])).toBe(3500);
    expect(orderTotalPence([])).toBe(0);
  });

  describe("bundle split", () => {
    it("splits proportionally to what the parts cost separately", () => {
      // £30 bundle of a £22 hoodie and a £18 jogger
      const parts = splitBundlePence(3000, [22, 18]);
      expect(parts).toEqual([1650, 1350]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(3000);
    });

    it("always sums to exactly the bundle price, however awkward the split", () => {
      for (const [total, prices] of [
        [1000, [3, 3, 3]],
        [999, [22, 18, 13]],
        [3333, [1, 1, 1, 1, 1, 1, 1]],
        [1, [22, 18]],
        [0, [22, 18]],
      ] as [number, number[]][]) {
        const parts = splitBundlePence(total, prices);
        expect(parts.reduce((a, b) => a + b, 0), `${total} across ${prices}`).toBe(total);
        expect(parts.length).toBe(prices.length);
      }
    });

    it("puts the rounding on the last component, not spread around", () => {
      // 1000 / 3 equal parts: 333, 333, then 334
      expect(splitBundlePence(1000, [3, 3, 3])).toEqual([333, 333, 334]);
    });

    it("splits evenly when every component is free", () => {
      expect(splitBundlePence(900, [0, 0, 0])).toEqual([300, 300, 300]);
    });

    it("handles one component and none at all", () => {
      expect(splitBundlePence(2200, [22])).toEqual([2200]);
      expect(splitBundlePence(2200, [])).toEqual([]);
    });

    it("never produces a negative part", () => {
      const parts = splitBundlePence(100, [1000, 1, 1]);
      expect(parts.every((p) => p >= 0), `got ${parts}`).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
describe("the client mirror and the server copy", () => {
  it("price identically", async () => {
    const server = await import("../../supabase/functions/_shared/merchPricing.ts");
    const item = { base_price: 22 };
    for (const qty of [1, 2, 20, 999]) {
      for (const pers of [0, 300, 900]) {
        expect(server.linePence(item, {}, pers, qty)).toBe(linePence(item, {}, pers, qty));
      }
    }
    for (const [total, prices] of [[3000, [22, 18]], [1000, [3, 3, 3]], [999, [22, 18, 13]]] as [number, number[]][]) {
      expect(server.splitBundlePence(total, prices)).toEqual(splitBundlePence(total, prices));
    }
    expect(server.unitPricePence(item, { price_override: 25 })).toBe(unitPricePence(item, { price_override: 25 }));
    expect(server.clampQuantity(999)).toBe(clampQuantity(999));
  });
});
