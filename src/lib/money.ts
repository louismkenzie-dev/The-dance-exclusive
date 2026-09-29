// Mirror of supabase/functions/_shared/money.ts — KEEP THE TWO IN SYNC.
// money.test.ts fails if they ever disagree.
//
/**
 * Splitting a sum of pence into shares that add back to exactly the sum.
 *
 * Used for a bundle's price across its garments, and for a payment — and its Stripe and Nullshift
 * fees — across the classes it paid for.
 *
 * LARGEST-REMAINDER, not "round each share and let the last one absorb the difference". The latter
 * was the first version, and it goes negative: 5p across 7 classes rounds each share of 0.71p up to
 * 1p, overshoots by 2p, and leaves the last class at −1p. A Stripe fee spread across a family on the
 * unlimited cap is exactly that shape of input.
 *
 * Here every share is floored, and the pence left over go one each to the shares with the largest
 * fractional remainders. Every share is therefore within 1p of its true value, none is ever
 * negative, and the total is exact. Ties go to the LATER share, so an even three-way split of £10
 * is 333 / 333 / 334 — the rounding lands on the last item, as it always has.
 */

/**
 * Split `total` pence across `weights`, proportionally. Weights are any non-negative numbers in any
 * unit. All-zero (or empty-valued) weights split evenly. A negative total is split as its
 * magnitude and negated, so a refund mirrors the charge it reverses.
 */
export function splitPence(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const whole = Math.round(Number(total) || 0);
  if (whole < 0) return splitPence(-whole, weights).map((p) => (p === 0 ? 0 : -p));

  const clean = weights.map((w) => {
    const x = Number(w);
    return Number.isFinite(x) && x > 0 ? x : 0;
  });
  const sum = clean.reduce((a, b) => a + b, 0);
  const basis = sum > 0 ? clean : clean.map(() => 1);
  const basisSum = sum > 0 ? sum : n;

  const exact = basis.map((w) => (whole * w) / basisSum);
  const shares = exact.map((x) => Math.floor(x));
  let left = whole - shares.reduce((a, b) => a + b, 0);

  // Hand the leftover pence to the largest remainders; ties to the later index.
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r || b.i - a.i);
  for (let k = 0; left > 0; k = (k + 1) % n, left--) shares[order[k].i] += 1;

  return shares;
}

/** Pounds (possibly a numeric column's string) to whole pence. */
export function poundsToPence(amount: number | string | null | undefined): number {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function sumPence(values: number[]): number {
  return values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
}
