/**
 * Single source of truth for merchandise categories.
 *
 * The admin page writes `merchandise_items.category`, so its list is canonical. The shop used to
 * keep a second, differently-spelled map ("hoodies"/"t-shirts" vs "hoodie"/"t-shirt"), which meant
 * every real product fell through to the raw slug and parents saw "dance-pants" on the filter
 * chips. Both pages now read from here.
 */

export type MerchCategory = { value: string; label: string };

export const MERCH_CATEGORIES: MerchCategory[] = [
  { value: "t-shirt", label: "T-Shirts" },
  { value: "hoodie", label: "Hoodies" },
  { value: "jumper", label: "Jumpers" },
  { value: "dance-pants", label: "Bottoms" },
  { value: "bag", label: "Bags" },
  { value: "water-bottle", label: "Water Bottles" },
  { value: "baseball-cap", label: "Caps" },
  { value: "accessories", label: "Accessories" },
  { value: "other", label: "Other" },
];

const BY_VALUE = new Map(MERCH_CATEGORIES.map((c) => [c.value, c.label]));

/**
 * Label for a category slug. Unknown slugs are title-cased rather than shown raw, so a category
 * added straight into the database still reads as "Leg Warmers" and never as "leg-warmers".
 */
export function merchCategoryLabel(value: string | null | undefined): string {
  if (!value) return "Other";
  const known = BY_VALUE.get(value);
  if (known) return known;
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Sort key so shop chips appear in the canonical order, with unknown slugs last (alphabetically). */
export function merchCategoryOrder(value: string): number {
  const i = MERCH_CATEGORIES.findIndex((c) => c.value === value);
  return i === -1 ? MERCH_CATEGORIES.length : i;
}
