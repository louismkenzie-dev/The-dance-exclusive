// Mirror of supabase/functions/_shared/membershipPause.ts — KEEP THE TWO IN
// SYNC. membershipPause.test.ts fails if they ever disagree.
//
// Pausing a family's monthly payments.
//
// Amie, via Louis: "Brooke George ... she's had a seizure, bless her, and
// they're on unlimited. I said I'll pause it for October because she can't
// walk at the moment. How do I go about doing that?"
//
// A pause is not a cancellation and not a discount: the family keeps every
// place, keeps their price, and simply is not charged for an agreed number of
// months. Stripe does this with pause_collection { behavior: "void" } — the
// invoices are still raised on the usual day and then voided, so nothing is
// collected and nothing is owed later. It is the same mechanism the August
// free month already uses.
//
// Everything here is date arithmetic, which is where this kind of feature
// goes wrong: pause a day too late and the family is charged anyway; resume a
// day too early and Stripe collects the invoice you meant to void. So it is a
// pure module with its own tests, and the server and the screen both read
// from it — what Amie is promised on the confirm button is what Stripe is
// told.

/** Add whole months, clamping to the end of a short month (31 Jan → 28 Feb). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + n);
  if (d.getUTCDate() < day) d.setUTCDate(0); // rolled into the next month — step back
  return d;
}

export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

export interface PausePlan {
  /** The payment dates that will NOT be taken, earliest first. */
  skipped: string[];
  /** The first payment they WILL be charged after the pause. */
  restartsOn: string;
  /**
   * What Stripe is told: collection resumes at this instant. It sits inside
   * the gap — after the last skipped payment, comfortably before the restart —
   * so neither end can be lost to a clock difference or a slow job.
   */
  resumesAt: Date;
  /** Total the family is not being asked for. */
  skippedTotal: number;
}

/**
 * `nextCharge` is the subscription's current_period_end — the next day money
 * would be taken. `months` is how many of those payments to skip.
 */
export function planPause(nextCharge: Date, months: number, monthlyTotal: number): PausePlan {
  const n = Math.max(1, Math.floor(months));
  const skipped: string[] = [];
  for (let i = 0; i < n; i++) skipped.push(isoDate(addMonths(nextCharge, i)));
  const restart = addMonths(nextCharge, n);
  // Two days inside the gap. One day would be enough for Stripe, but the
  // nightly maintenance job and the billing clock are hours apart, and a gap
  // measured in hours is the kind that works in September and fails in March.
  const resumesAt = new Date(restart.getTime() - 2 * 24 * 3600 * 1000);
  return {
    skipped,
    restartsOn: isoDate(restart),
    resumesAt,
    skippedTotal: Math.round(monthlyTotal * n * 100) / 100,
  };
}

/**
 * A pause can only be set up while there is still a payment ahead of it.
 * Returns the reason it cannot go ahead, or null when it can.
 */
export function pauseBlockedReason(
  nextCharge: Date | null,
  now: Date,
  status: string,
): string | null {
  if (status === "cancelled") return "This membership has already ended.";
  if (status === "incomplete") return "This membership hasn't started yet — there's nothing to pause.";
  if (!nextCharge) return "This membership has no upcoming payment date, so there's nothing to pause.";
  if (nextCharge.getTime() <= now.getTime()) {
    return "The next payment is already due or being taken — pause from the following month, or adjust this one instead.";
  }
  return null;
}

/** Plain English for the screen and the confirmation. */
export function describePause(plan: PausePlan, fmt: (iso: string) => string): string {
  const list = plan.skipped.map(fmt).join(", ");
  return plan.skipped.length === 1
    ? `The payment on ${list} won't be taken. Billing starts again on ${fmt(plan.restartsOn)}.`
    : `${plan.skipped.length} payments won't be taken (${list}). Billing starts again on ${fmt(plan.restartsOn)}.`;
}
