// Mirror of supabase/functions/_shared/merchPricing.ts — KEEP THE TWO IN SYNC.
// merchPricing.test.ts fails if they ever disagree.
//
/**
 * Merchandise money. Everything here is in PENCE.
 *
 * Pounds-as-floats is how prices drift: 0.1 + 0.2 is not 0.3, and a bundle split in pounds ends
 * up a penny out from the total the customer was shown. So every amount is converted to an
 * integer number of pence exactly once, at the boundary, and all arithmetic happens there.
 *
 * The server is the price authority — the client sends variant ids and choices, never amounts —
 * so this module is mirrored rather than shared, and a drift test holds the two copies together.
 */

/** Stripe and the basket both cap a single line. */
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 20;

export type PricedItem = { base_price?: number | null };
export type PricedVariant = { price_override?: number | null };

/** Pounds (possibly a string from a numeric column) to whole pence. */
export function toPence(amount: number | string | null | undefined): number {
  const n = Number(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function clampQuantity(qty: number | string | null | undefined): number {
  const n = Math.floor(Number(qty));
  if (!Number.isFinite(n)) return MIN_QUANTITY;
  return Math.max(MIN_QUANTITY, Math.min(MAX_QUANTITY, n));
}

/** What one garment costs before personalisation. A size may override the product price. */
export function unitPricePence(item: PricedItem, variant: PricedVariant): number {
  const override = variant?.price_override;
  if (override !== null && override !== undefined && Number.isFinite(Number(override))) {
    return toPence(override);
  }
  return toPence(item?.base_price);
}

/**
 * One basket line.
 *
 * Personalisation multiplies by quantity because each garment is printed separately: two hoodies
 * both reading EVIE is two lots of £3, not one.
 */
export function linePence(
  item: PricedItem,
  variant: PricedVariant,
  personalisationPence: number,
  qty: number,
): number {
  const unit = unitPricePence(item, variant) + Math.max(0, Math.round(personalisationPence || 0));
  return unit * clampQuantity(qty);
}

export function orderTotalPence(lines: number[]): number {
  return lines.reduce((sum, p) => sum + (Number.isFinite(p) ? p : 0), 0);
}

/**
 * Split a bundle's price across its garments, proportionally to what they cost separately.
 *
 * Each component needs its own price because each becomes its own order line — its own size, its
 * own print row, its own refund. The last component absorbs the rounding so the parts always sum
 * to exactly the bundle price; the same technique admin-book uses to split an amount across dates.
 */
export function splitBundlePence(bundlePence: number, componentPrices: (number | string)[]): number[] {
  const n = componentPrices.length;
  if (n === 0) return [];
  const total = Math.max(0, Math.round(bundlePence || 0));
  if (n === 1) return [total];

  const parts = componentPrices.map(toPence);
  const sum = parts.reduce((a, b) => a + b, 0);

  // All components free (or priceless) — nothing to weight by, so split evenly.
  const weights = sum > 0 ? parts : parts.map(() => 1);
  const weightSum = sum > 0 ? sum : n;

  const out: number[] = [];
  let allocated = 0;
  for (let i = 0; i < n - 1; i++) {
    const share = Math.round((total * weights[i]) / weightSum);
    out.push(share);
    allocated += share;
  }
  out.push(total - allocated); // the last one takes whatever is left
  return out;
}
