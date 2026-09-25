// Mirror of supabase/functions/_shared/merchPrintRun.ts — KEEP THE TWO IN SYNC.
// merchPrintRun.test.ts fails if they ever disagree.
//
/**
 * Turning paid orders into the sheet Laurence at Any Wear actually works from.
 *
 * Two shapes come out of here:
 *
 *   printRunRows()  — one row per garment to print, with the personalisation spelled out. This is
 *                     the CSV attachment, and it is what gets packed against.
 *   aggregate()     — product + size + total quantity. This goes in the body of the email, so the
 *                     run can be sanity-checked at a glance before the file is opened.
 *
 * (A CSV has no second sheet, which is why the aggregate lives in the email rather than in the
 * file — the plan originally said "sheet 2".)
 *
 * SIZE ORDERING IS THE TRAP. Sorting sizes as text puts "Age 11-12" before "Age 9-10", because
 * "1" sorts before "9", and it scatters S / M / L / XL alphabetically. A printer reading that
 * list works through it in the wrong order and mis-counts a batch. So sizes sort by their position
 * in the studio's own size list.
 */

/** The studio's canonical size run — the same list the admin size picker offers. */
export const MERCH_SIZES = [
  "XS", "S", "M", "L", "XL", "XXL",
  "Age 3-4", "Age 5-6", "Age 7-8", "Age 9-10", "Age 11-12",
  "One Size",
];

const SIZE_RANK = new Map(MERCH_SIZES.map((s, i) => [s.toLowerCase(), i]));

/** Sort comparator for sizes: canonical order first, anything unrecognised last and alphabetical. */
export function compareSizes(a: string | null | undefined, b: string | null | undefined): number {
  const av = (a ?? "").trim();
  const bv = (b ?? "").trim();
  const ar = SIZE_RANK.has(av.toLowerCase()) ? SIZE_RANK.get(av.toLowerCase())! : MERCH_SIZES.length;
  const br = SIZE_RANK.has(bv.toLowerCase()) ? SIZE_RANK.get(bv.toLowerCase())! : MERCH_SIZES.length;
  if (ar !== br) return ar - br;
  // Same canonical size — "M" and " m " are one size, so they tie rather than sorting by case.
  // Only unrecognised sizes, which all share the last rank, fall back to alphabetical.
  if (ar < MERCH_SIZES.length) return 0;
  return av.localeCompare(bv);
}

export type PrintLine = {
  order_number?: number | string | null;
  product_name?: string | null;
  size?: string | null;
  quantity?: number | null;
  attendee_name?: string | null;
  personalisations?: { placement: string; text: string }[] | null;
};

export type PrintRow = {
  order: string;
  dancer: string;
  product: string;
  size: string;
  quantity: number;
  front: string;
  back: string;
  sleeve: string;
};

export const PRINT_RUN_HEADER = [
  "Order", "Dancer", "Product", "Size", "Qty", "Front", "Back", "Sleeve",
];

function placementText(line: PrintLine, placement: string): string {
  return (line.personalisations ?? []).find((p) => p.placement === placement)?.text ?? "";
}

/**
 * One row per garment, sorted the way a printer works: by product, then size, then dancer.
 * Personalisation is pivoted into fixed columns so the sheet has the same shape every time —
 * a column that appears only when someone bought it is a column nobody notices.
 */
export function printRunRows(lines: PrintLine[]): PrintRow[] {
  return lines
    .map((l) => ({
      order: l.order_number === null || l.order_number === undefined ? "" : String(l.order_number),
      dancer: (l.attendee_name ?? "").trim(),
      product: (l.product_name ?? "").trim(),
      size: (l.size ?? "").trim(),
      quantity: Math.max(0, Math.floor(Number(l.quantity) || 0)),
      front: placementText(l, "front"),
      back: placementText(l, "back"),
      sleeve: placementText(l, "sleeve"),
    }))
    .sort(
      (a, b) =>
        a.product.localeCompare(b.product) ||
        compareSizes(a.size, b.size) ||
        a.dancer.localeCompare(b.dancer) ||
        a.order.localeCompare(b.order),
    );
}

export type AggregateRow = { product: string; size: string; quantity: number };

/** Product + size totals for the covering email. Same sort order as the rows. */
export function aggregate(lines: PrintLine[]): AggregateRow[] {
  const byKey = new Map<string, AggregateRow>();
  for (const row of printRunRows(lines)) {
    const key = `${row.product}\u0000${row.size}`;
    const existing = byKey.get(key);
    if (existing) existing.quantity += row.quantity;
    else byKey.set(key, { product: row.product, size: row.size, quantity: row.quantity });
  }
  return [...byKey.values()].sort(
    (a, b) => a.product.localeCompare(b.product) || compareSizes(a.size, b.size),
  );
}

/** Total garments in the run — what goes in the subject line. */
export function totalGarments(lines: PrintLine[]): number {
  return printRunRows(lines).reduce((sum, r) => sum + r.quantity, 0);
}

/** How many of those carry a name, so the covering email can say so. */
export function personalisedCount(lines: PrintLine[]): number {
  return printRunRows(lines)
    .filter((r) => r.front || r.back || r.sleeve)
    .reduce((sum, r) => sum + r.quantity, 0);
}

/** The CSV body as a plain array-of-arrays, ready for toCsv(). */
export function printRunCsvRows(lines: PrintLine[]): (string | number)[][] {
  return printRunRows(lines).map((r) => [
    r.order, r.dancer, r.product, r.size, r.quantity, r.front, r.back, r.sleeve,
  ]);
}
