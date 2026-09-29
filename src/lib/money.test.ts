import { describe, it, expect } from "vitest";
import { splitPence, poundsToPence, sumPence } from "./money";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("splitPence", () => {
  it("THE BUG: 5p across 7 must never produce a negative share", () => {
    // The first version rounded each 0.71p share up to 1p and left the last at −1p.
    // A Stripe fee spread across a family on the unlimited cap is exactly this shape.
    const parts = splitPence(5, [1, 1, 1, 1, 1, 1, 1]);
    expect(parts.every((p) => p >= 0), JSON.stringify(parts)).toBe(true);
    expect(sum(parts)).toBe(5);
  });

  it("never goes negative and always sums exactly — exhaustively for small inputs", () => {
    for (let total = 0; total <= 60; total++) {
      for (let n = 1; n <= 9; n++) {
        const parts = splitPence(total, Array(n).fill(1));
        expect(sum(parts), `${total} across ${n}`).toBe(total);
        expect(parts.every((p) => p >= 0), `${total} across ${n}: ${parts}`).toBe(true);
        // every share within 1p of its true value
        expect(Math.max(...parts) - Math.min(...parts), `${total} across ${n}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("holds for uneven weights too", () => {
    for (const [total, w] of [
      [5, [1000, 1, 1]], [1, [3, 3, 3]], [999, [22, 18, 13]], [7, [0.35, 26.35, 30.6, 26.35]],
    ] as [number, number[]][]) {
      const parts = splitPence(total, w);
      expect(sum(parts), `${total} / ${w}`).toBe(total);
      expect(parts.every((p) => p >= 0), `${total} / ${w}: ${parts}`).toBe(true);
    }
  });

  it("puts the leftover penny on the LAST share when all else is equal", () => {
    expect(splitPence(1000, [1, 1, 1])).toEqual([333, 333, 334]);
    expect(splitPence(1100, [1, 1, 1])).toEqual([366, 367, 367]);
  });

  it("splits proportionally", () => {
    expect(splitPence(3000, [22, 18])).toEqual([1650, 1350]);
    expect(splitPence(11000, [1, 1, 1, 1])).toEqual([2750, 2750, 2750, 2750]); // £110 across 4 classes
  });

  it("splits evenly when there is nothing to weight by", () => {
    expect(splitPence(900, [0, 0, 0])).toEqual([300, 300, 300]);
    expect(splitPence(900, [NaN, -5, 0])).toEqual([300, 300, 300]);
  });

  it("mirrors a refund: a negative total splits as the charge did, negated", () => {
    expect(splitPence(-1000, [1, 1, 1])).toEqual([-333, -333, -334]);
    expect(sum(splitPence(-5, [1, 1, 1, 1, 1, 1, 1]))).toBe(-5);
  });

  it("handles the degenerate cases", () => {
    expect(splitPence(500, [])).toEqual([]);
    expect(splitPence(500, [7])).toEqual([500]);
    expect(splitPence(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });
});

describe("poundsToPence / sumPence", () => {
  it("converts, including numeric-column strings", () => {
    expect(poundsToPence("30.60")).toBe(3060);
    expect(poundsToPence(0.1 + 0.2)).toBe(30);
    expect(poundsToPence(null)).toBe(0);
  });
  it("sums, ignoring junk", () => {
    expect(sumPence([100, NaN, 250])).toBe(350);
  });
});

describe("the client mirror and the server copy", () => {
  it("agree", async () => {
    const server = await import("../../supabase/functions/_shared/money.ts");
    for (const [t, w] of [[5, [1, 1, 1, 1, 1, 1, 1]], [1000, [1, 1, 1]], [-7, [2, 1]], [999, [22, 18, 13]]] as [number, number[]][]) {
      expect(server.splitPence(t, w)).toEqual(splitPence(t, w));
    }
  });
});
