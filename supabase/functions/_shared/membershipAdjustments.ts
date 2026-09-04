// One-month membership payment adjustments ("£7 off February") reach Stripe
// as a pending invoice item on the family's subscription, which lands on
// that month's invoice. Shared by manage-membership (admin creates one) and
// memberships-maintenance (nightly hand-over of ones for later months).
//
// Every Stripe write here must be safe to repeat: a lost response, a failed
// DB update or a re-run must never produce a second credit on the invoice.
// So before creating, we look for an invoice item already tagged with the
// adjustment's id, and the create itself carries an idempotency key.

export interface AdjustmentRow {
  id: string;
  membership_id: string;
  billing_month: string;
  amount: number | string;
  reason: string | null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "YYYY-MM" of a date, UTC (billing runs at 07:00 UTC on the 5th, so UTC and London agree). */
export const yearMonth = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** "February 2027" for "2027-02" or "2027-02-01". */
export const monthLabel = (ym: string) => {
  const [y, m] = ym.slice(0, 7).split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** What the family sees on their Stripe invoice line. */
export const adjustmentDescription = (pounds: number, reason: string | null) =>
  pounds < 0
    ? `Credit from The Dance Exclusive — ${reason ?? "adjustment"}`
    : `The Dance Exclusive — ${reason ?? "adjustment"}`;

/**
 * Find the pending invoice item already created for this adjustment, if any
 * (matched on metadata.adjustmentId), otherwise create it. Returns the item.
 */
export async function ensureAdjustmentInvoiceItem(
  stripe: any,
  connectOpts: Record<string, unknown>,
  customerId: string,
  subscriptionId: string,
  adj: AdjustmentRow,
): Promise<any> {
  try {
    const pending = await stripe.invoiceItems.list(
      { customer: customerId, pending: true, limit: 100 },
      connectOpts,
    );
    const existing = (pending?.data ?? []).find(
      (item: any) => item?.metadata?.adjustmentId === adj.id,
    );
    if (existing) return existing;
  } catch (e) {
    // Listing is a safety net only; the idempotency key still guards the create.
    console.error("Could not list pending invoice items for", customerId, e);
  }

  const pounds = Number(adj.amount);
  return await stripe.invoiceItems.create(
    {
      customer: customerId,
      subscription: subscriptionId,
      amount: Math.round(pounds * 100),
      currency: "gbp",
      description: adjustmentDescription(pounds, adj.reason),
      metadata: { adjustmentId: adj.id, membershipId: adj.membership_id },
    },
    { ...connectOpts, idempotencyKey: `membership-adjustment-${adj.id}` },
  );
}

/** Record that the invoice item exists. Returns false if the DB update failed. */
export async function markAdjustmentApplied(
  supabase: any,
  adjustmentId: string,
  invoiceItemId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("membership_adjustments")
    .update({ status: "applied", stripe_invoice_item_id: invoiceItemId, applied_at: new Date().toISOString() })
    .eq("id", adjustmentId)
    .neq("status", "removed");
  if (error) {
    console.error("Could not mark adjustment applied", adjustmentId, error);
    return false;
  }
  return true;
}

/**
 * Pending adjustments that can no longer reach an invoice (the membership
 * has ended, or ends before that month) are retired so they don't sit
 * "pending" forever looking like a promise.
 */
export async function retirePendingAdjustments(
  supabase: any,
  membershipId: string,
  afterYearMonth: string | null,
  note: string,
): Promise<number> {
  let q = supabase
    .from("membership_adjustments")
    .select("id, billing_month, reason")
    .eq("membership_id", membershipId)
    .eq("status", "pending");
  if (afterYearMonth) q = q.gt("billing_month", `${afterYearMonth}-01`);
  const { data } = await q;
  let n = 0;
  for (const adj of data ?? []) {
    const { error } = await supabase
      .from("membership_adjustments")
      .update({
        status: "removed",
        removed_at: new Date().toISOString(),
        reason: `${adj.reason ?? ""} (${note})`.trim(),
      })
      .eq("id", adj.id)
      .eq("status", "pending");
    if (!error) n++;
  }
  return n;
}
