// Mirror of src/lib/merchStatus.ts — KEEP THE TWO IN SYNC.
// merchStatus.test.ts fails if they ever disagree.
//
/**
 * Where a merchandise line has got to, and where it is allowed to go next.
 *
 * The happy path is exactly what Amie described:
 *
 *   pending → paid → sent_to_print → ready → collected
 *
 * plus three ways out: `expired` (a basket that was never paid for), `cancelled` and `refunded`.
 *
 * The ranking here MUST match merch_order_rollup_status() in
 * 20260925150000_merch_orders.sql — the trigger sets the order's status from the least-advanced
 * live line, and the admin console sorts by the same idea. If the two drift, the console shows a
 * different state from the database. There is a test asserting the ranks case for case.
 */

export const MERCH_STATUSES = [
  "pending", "paid", "sent_to_print", "ready", "collected", "expired", "cancelled", "refunded",
] as const;

export type MerchStatus = (typeof MERCH_STATUSES)[number];

/** Matches the CASE in merch_order_rollup_status(). Anything off the happy path ranks 9. */
const RANK: Record<string, number> = {
  pending: 0,
  paid: 1,
  sent_to_print: 2,
  ready: 3,
  collected: 4,
};
const OFF_PATH_RANK = 9;

export function statusRank(status: string): number {
  return RANK[status] ?? OFF_PATH_RANK;
}

/** True for the three states a line can never leave. */
export function isTerminal(status: string): boolean {
  return status === "expired" || status === "cancelled" || status === "refunded";
}

const ALLOWED: Record<string, MerchStatus[]> = {
  pending: ["paid", "expired", "cancelled"],
  paid: ["sent_to_print", "cancelled", "refunded"],
  // Back from the printers is exactly this step.
  sent_to_print: ["ready", "cancelled", "refunded"],
  ready: ["collected", "cancelled", "refunded"],
  // Still refundable after hand-over: the garment may be wrong, and Amie is the only one who can
  // do it anyway.
  collected: ["refunded"],
  expired: [],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return false;
  return (ALLOWED[from] ?? []).includes(to as MerchStatus);
}

export function nextStatuses(from: string): MerchStatus[] {
  return ALLOWED[from] ?? [];
}

/**
 * The order's status, from its lines: the least-advanced line still on the happy path.
 *
 * Cancelled and refunded lines are ignored while any live line remains, because an order with one
 * refunded tee and one hoodie still to hand over is still "ready" as far as Amie is concerned.
 * When every line is off the path, the least-advanced of those is used instead.
 */
export function rollupStatus(lineStatuses: string[]): MerchStatus {
  if (!lineStatuses.length) return "pending";
  const live = lineStatuses.filter((s) => statusRank(s) < OFF_PATH_RANK);
  const pool = live.length ? live : lineStatuses;
  return [...pool].sort((a, b) => statusRank(a) - statusRank(b))[0] as MerchStatus;
}

/** Human labels, used on the admin console and in emails. */
export const MERCH_STATUS_LABEL: Record<MerchStatus, string> = {
  pending: "Awaiting payment",
  paid: "Waiting to print",
  sent_to_print: "At the printers",
  ready: "Ready to hand out",
  collected: "Collected",
  expired: "Expired",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function merchStatusLabel(status: string): string {
  return MERCH_STATUS_LABEL[status as MerchStatus] ?? status;
}
