/**
 * Per-class financial reporting: what a class actually earned once the card
 * processing fee and the platform fee have come off.
 *
 * Fees are charged per PAYMENT, not per booking — a parent paying for three
 * children in one basket pays Stripe's fixed 20p once. So the money is grouped
 * by the payment it arrived in, the fees are worked out on that payment, and
 * then split back across its bookings in proportion to what each one cost.
 * Pennies left over by the split are handed to the largest booking, so the
 * per-class figures always add back up to the payment's real fee.
 */

export interface FeeRates {
  /** Stripe's percentage of each payment. */
  stripePercent: number;
  /** Stripe's fixed charge per payment, in pence. */
  stripeFixedPence: number;
  /** The platform (Nullshift) booking fee percentage. */
  platformPercent: number;
}

/**
 * Stripe UK standard pricing for domestic cards, plus the agreed 1% platform
 * fee. `platformPercent` must stay in step with DEFAULT_PLATFORM_FEE_PERCENT
 * in supabase/functions/_shared/platformFee.ts — classFinance.test.ts checks
 * the two agree.
 */
export const DEFAULT_FEE_RATES: FeeRates = {
  stripePercent: 1.5,
  stripeFixedPence: 20,
  platformPercent: 1,
};

export interface RevenueLine {
  classId: string | null;
  className: string;
  /** Groups bookings that were paid for together. Null = its own payment. */
  paymentRef: string | null;
  /** What the family was charged for this booking, in pounds. */
  amount: number;
  /** True when no card was involved (free place, comp, admin-recorded). */
  free?: boolean;
}

export interface ClassFinanceRow {
  classId: string | null;
  className: string;
  bookings: number;
  gross: number;
  stripeFee: number;
  platformFee: number;
  net: number;
}

const toPence = (pounds: number) => Math.round(Number(pounds || 0) * 100);

/** Platform fee in pence — the same rule the Stripe functions apply. */
export function platformFeeOf(amountInPence: number, percent: number): number {
  if (!Number.isFinite(amountInPence) || amountInPence <= 0) return 0;
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.max(1, Math.round((amountInPence * percent) / 100));
}

/** Stripe's processing fee in pence for one payment. */
export function stripeFeeOf(amountInPence: number, rates: FeeRates): number {
  if (!Number.isFinite(amountInPence) || amountInPence <= 0) return 0;
  return Math.round((amountInPence * rates.stripePercent) / 100) + rates.stripeFixedPence;
}

/**
 * Split a payment's fee across its bookings in proportion to their value,
 * giving any leftover pennies to the biggest booking so the parts sum exactly.
 */
function allocate(feePence: number, amountsInPence: number[]): number[] {
  const total = amountsInPence.reduce((sum, a) => sum + a, 0);
  if (feePence <= 0 || total <= 0) return amountsInPence.map(() => 0);
  const shares = amountsInPence.map((a) => Math.floor((a * feePence) / total));
  let remainder = feePence - shares.reduce((sum, s) => sum + s, 0);
  // Hand the remaining pennies out largest-booking-first.
  const order = amountsInPence
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a - x.a || x.i - y.i);
  for (let k = 0; remainder > 0 && k < order.length; k++, remainder--) {
    shares[order[k].i] += 1;
  }
  return shares;
}

/**
 * Roll a list of paid bookings up into one row per class, with the fees each
 * class carried and what the studio was left with.
 */
export function summariseByClass(
  lines: RevenueLine[],
  rates: FeeRates = DEFAULT_FEE_RATES,
): ClassFinanceRow[] {
  // Group by payment. Bookings with no reference (comps, hand-recorded
  // payments) are each their own payment — that's how they were taken.
  const groups = new Map<string, RevenueLine[]>();
  lines.forEach((line, index) => {
    const key = line.paymentRef ? `ref:${line.paymentRef}` : `line:${index}`;
    const existing = groups.get(key);
    if (existing) existing.push(line);
    else groups.set(key, [line]);
  });

  const byClass = new Map<string, ClassFinanceRow>();
  const rowFor = (line: RevenueLine): ClassFinanceRow => {
    const key = line.classId ?? `name:${line.className}`;
    let row = byClass.get(key);
    if (!row) {
      row = {
        classId: line.classId,
        className: line.className,
        bookings: 0,
        gross: 0,
        stripeFee: 0,
        platformFee: 0,
        net: 0,
      };
      byClass.set(key, row);
    }
    return row;
  };

  for (const group of groups.values()) {
    const amounts = group.map((l) => toPence(l.amount));
    const paidAmounts = group.map((l, i) => (l.free ? 0 : amounts[i]));
    const chargedPence = paidAmounts.reduce((sum, a) => sum + a, 0);

    const stripeShares = allocate(stripeFeeOf(chargedPence, rates), paidAmounts);
    const platformShares = allocate(
      platformFeeOf(chargedPence, rates.platformPercent),
      paidAmounts,
    );

    group.forEach((line, i) => {
      const row = rowFor(line);
      row.bookings += 1;
      row.gross += amounts[i] / 100;
      row.stripeFee += stripeShares[i] / 100;
      row.platformFee += platformShares[i] / 100;
      row.net += (amounts[i] - stripeShares[i] - platformShares[i]) / 100;
    });
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return [...byClass.values()]
    .map((row) => ({
      ...row,
      gross: round2(row.gross),
      stripeFee: round2(row.stripeFee),
      platformFee: round2(row.platformFee),
      net: round2(row.net),
    }))
    .sort((a, b) => b.gross - a.gross || a.className.localeCompare(b.className));
}

/** Column totals for the bottom of the report. */
export function totalsOf(rows: ClassFinanceRow[]) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  return rows.reduce(
    (totals, row) => ({
      bookings: totals.bookings + row.bookings,
      gross: round2(totals.gross + row.gross),
      stripeFee: round2(totals.stripeFee + row.stripeFee),
      platformFee: round2(totals.platformFee + row.platformFee),
      net: round2(totals.net + row.net),
    }),
    { bookings: 0, gross: 0, stripeFee: 0, platformFee: 0, net: 0 },
  );
}

/**
 * The payment a booking belongs to, read from its notes. Bookings created by
 * checkout carry their Stripe PaymentIntent (or, for a free basket, the
 * reference the server made for it).
 */
export function paymentRefOf(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const stripeRef = /(?:Stripe PaymentIntent|PaymentIntent):\s*(\S+)/i.exec(notes);
  if (stripeRef) return stripeRef[1];
  const freeRef = /\b(free_[0-9a-f-]{8,})\b/i.exec(notes);
  if (freeRef) return freeRef[1];
  const subRef = /\b(sub_[A-Za-z0-9]+)\b/.exec(notes);
  return subRef ? subRef[1] : null;
}
