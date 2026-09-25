/**
 * Two kinds of merchandise, and they behave differently.
 *
 * Amie prints hoodies and tees to order — there is no box of them anywhere, so they can never run
 * out and a stock number against them is meaningless. Water bottles and bags she actually holds,
 * and those genuinely can sell out.
 *
 * `merchandise_items.tracks_stock` distinguishes them. It defaults to true so nothing about the
 * existing catalogue changes when the column lands; Amie unticks the printed ones.
 *
 * Getting this backwards is the expensive mistake: every product in the live catalogue currently
 * has zero stock on every size, so treating untracked items as "0 means sold out" would show the
 * entire shop as unavailable.
 */

export type StockedItem = { tracks_stock?: boolean | null };
export type StockedVariant = { is_active?: boolean | null; stock_quantity?: number | null };

/** Does this product count stock at all? Absent column (pre-migration) reads as "yes", as it does today. */
export function tracksStock(item: StockedItem | null | undefined): boolean {
  return item?.tracks_stock !== false;
}

/** Can this specific size be bought right now? */
export function variantInStock(item: StockedItem, variant: StockedVariant): boolean {
  if (variant.is_active === false) return false;
  if (!tracksStock(item)) return true;
  return (variant.stock_quantity ?? 0) > 0;
}

/** Is anything on this product buyable? Drives the "Sold out" badge on a tile. */
export function itemInStock(item: StockedItem, variants: StockedVariant[] | null | undefined): boolean {
  const active = (variants ?? []).filter((v) => v.is_active !== false);
  if (!active.length) return false; // no sizes set up — nothing to buy, whatever the mode
  if (!tracksStock(item)) return true;
  return active.some((v) => (v.stock_quantity ?? 0) > 0);
}

/**
 * How many of this size may be ordered, or null when there is no limit.
 * Used by the checkout's short-stock check and the quantity stepper.
 */
export function availableQuantity(item: StockedItem, variant: StockedVariant): number | null {
  if (!tracksStock(item)) return null;
  return Math.max(0, variant.stock_quantity ?? 0);
}

/** Would ordering `qty` of this size oversell it? Never true for printed-to-order items. */
export function wouldOversell(item: StockedItem, variant: StockedVariant, qty: number): boolean {
  const available = availableQuantity(item, variant);
  return available !== null && qty > available;
}
