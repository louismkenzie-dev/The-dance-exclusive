// Mirror of supabase/functions/_shared/paymentAllocation.ts — KEEP THE TWO IN SYNC.
// paymentAllocation.test.ts fails if they ever disagree.
//
/**
 * Deciding which classes a payment paid for, and how much each one earned.
 *
 * payments-sync reads Stripe's balance transactions — the only place the gross, Stripe's fee and
 * the Nullshift 1% exist together — and uses this module to spread each one across classes,
 * camps and venues. The result is written once, as payment_allocations, and every report reads
 * only that. So the rules live here, tested, rather than being re-derived by each screen.
 *
 * THE RULES
 *
 *   Membership (a subscription invoice) — split EVENLY across every class on the invoice, including
 *     the ones the £110 unlimited cap has billed at £0. Louis's call: a class a child attends every
 *     week must not show as earning nothing just because of how Stripe apportioned the cap.
 *   One-off booking, camp, pass — split by each item's OWN price, because that is what was paid for.
 *   A class pass is not tied to a class, so it carries no class and the report files it under
 *     head office rather than inventing a class for it.
 *   Anything that cannot be matched becomes one explicit "unknown" allocation. Never dropped.
 *
 * Fees are spread with the same weights as the gross, each column split independently, so every
 * column sums back to exactly what Stripe reported.
 */
import { splitPence, poundsToPence } from "./money";

export type AllocationKind = "membership" | "class" | "camp" | "pass" | "party" | "merch" | "unknown";

export type AllocationTarget = {
  kind: AllocationKind;
  classId?: string | null;
  campId?: string | null;
  venueId?: string | null;
  studentId?: string | null;
  weight: number;
};

export type LedgerAmounts = {
  grossPence: number;
  stripeFeePence: number;
  platformFeePence: number;
};

export type Allocation = {
  kind: AllocationKind;
  classId: string | null;
  campId: string | null;
  venueId: string | null;
  studentId: string | null;
  grossPence: number;
  stripeFeePence: number;
  platformFeePence: number;
  netPence: number;
};

/**
 * Stripe's fee_details on a balance transaction, split into what Stripe kept and what Nullshift
 * kept. `application_fee` is ours; everything else — `stripe_fee`, and any `tax` or pass-through
 * card-network fee Stripe itemises — is a cost of taking the payment and counts as Stripe's.
 */
export function feesFromDetails(
  details: { type?: string | null; amount?: number | null }[] | null | undefined,
): { stripeFeePence: number; platformFeePence: number } {
  let stripeFeePence = 0;
  let platformFeePence = 0;
  for (const d of details ?? []) {
    const amount = Math.round(Number(d?.amount) || 0);
    if (d?.type === "application_fee") platformFeePence += amount;
    else stripeFeePence += amount;
  }
  return { stripeFeePence, platformFeePence };
}

/** Spread one balance transaction across its targets. */
export function allocate(amounts: LedgerAmounts, targets: AllocationTarget[]): Allocation[] {
  const gross = Math.round(amounts.grossPence || 0);
  const stripe = Math.round(amounts.stripeFeePence || 0);
  const platform = Math.round(amounts.platformFeePence || 0);

  const list: AllocationTarget[] = targets.length
    ? targets
    : [{ kind: "unknown", weight: 1 }];

  const weights = list.map((t) => t.weight);
  const g = splitPence(gross, weights);
  const s = splitPence(stripe, weights);
  const p = splitPence(platform, weights);

  return list.map((t, i) => ({
    kind: t.kind,
    classId: t.classId ?? null,
    campId: t.campId ?? null,
    venueId: t.venueId ?? null,
    studentId: t.studentId ?? null,
    grossPence: g[i],
    stripeFeePence: s[i],
    platformFeePence: p[i],
    netPence: g[i] - s[i] - p[i],
  }));
}

export type InvoiceLineLike = { subscriptionItemId: string | null | undefined };
export type MembershipLike = {
  stripeSubscriptionItemId: string | null | undefined;
  classId: string | null | undefined;
  studentId?: string | null;
  venueId?: string | null;
};

/**
 * A subscription invoice: one target per membership the invoice covers, weighted EQUALLY.
 *
 * Lines without a subscription item — a one-month adjustment Amie added, say — change the amount
 * charged but are not classes, so they do not become targets; their money is shared across the
 * classes like everything else on the invoice.
 */
export function subscriptionTargets(
  lines: InvoiceLineLike[],
  memberships: MembershipLike[],
): AllocationTarget[] {
  const byItem = new Map<string, MembershipLike>();
  for (const m of memberships) {
    if (m.stripeSubscriptionItemId) byItem.set(m.stripeSubscriptionItemId, m);
  }
  const seen = new Set<string>();
  const out: AllocationTarget[] = [];
  for (const line of lines) {
    const item = line.subscriptionItemId;
    if (!item || seen.has(item)) continue;
    const m = byItem.get(item);
    if (!m) continue;
    seen.add(item);
    out.push({
      kind: "membership",
      classId: m.classId ?? null,
      studentId: m.studentId ?? null,
      venueId: m.venueId ?? null,
      weight: 1,
    });
  }
  return out;
}

export type CartItemLike = {
  kind: "class" | "camp" | "pass";
  classId?: string | null;
  campId?: string | null;
  studentId?: string | null;
  /** Pounds, as the cart metadata carries it. */
  totalPrice?: number | null;
};

/** A one-off checkout: one target per item, weighted by what that item cost. */
export function oneOffTargets(items: CartItemLike[]): AllocationTarget[] {
  return items.map((it) => ({
    kind: it.kind === "camp" ? "camp" : it.kind === "pass" ? "pass" : "class",
    classId: it.kind === "class" ? it.classId ?? null : null,
    campId: it.kind === "camp" ? it.campId ?? null : null,
    studentId: it.studentId ?? null,
    weight: poundsToPence(it.totalPrice),
  }));
}

/**
 * A refund mirrors the charge it reverses: the same targets, weighted by what each one received.
 * So a refunded family's money comes back off the same classes it went to.
 */
export function refundTargets(original: Allocation[]): AllocationTarget[] {
  return original.map((a) => ({
    kind: a.kind,
    classId: a.classId,
    campId: a.campId,
    venueId: a.venueId,
    studentId: a.studentId,
    weight: Math.abs(a.grossPence),
  }));
}

/** Fill in venues from lookups, for targets that name a class or camp but not a venue. */
export function withVenues(
  targets: AllocationTarget[],
  classVenue: Map<string, string | null>,
  campVenue: Map<string, string | null>,
): AllocationTarget[] {
  return targets.map((t) => ({
    ...t,
    venueId:
      t.venueId ??
      (t.classId ? classVenue.get(t.classId) ?? null : null) ??
      (t.campId ? campVenue.get(t.campId) ?? null : null),
  }));
}
