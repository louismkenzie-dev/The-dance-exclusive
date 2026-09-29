/**
 * What each class is due to turn over in a month at today's bookings — the figure on each class
 * in Admin → Classes. Admin only, like everything else about money.
 *
 * It is not a prediction. It is what the memberships that are active right now will pay next
 * month, before fees, attributed the same way the Reports page attributes money that has actually
 * arrived — so the two agree by construction:
 *
 *   A family's subscription is split EVENLY across the classes it covers. £110 across four classes
 *   is £27.50 each, including a class the £110 cap has made free on the invoice. Louis's call: a
 *   class a child attends every week must not show as earning nothing.
 *
 * Only `active` memberships count. Paused ones pay nothing until they resume, `cancel_scheduled`
 * ones are leaving, and `incomplete` ones have never paid — those are counted separately, so the
 * class can say how many were left out rather than silently shrinking.
 */
import { poundsToPence, splitPence } from "./money";

export type ForecastMembership = {
  class_id: string | null;
  stripe_subscription_id: string | null;
  monthly_amount: number | string | null;
  status: string;
};

export type ClassForecast = {
  /** Due each month from active memberships, before Stripe's fee and the Nullshift 1%. */
  monthlyPence: number;
  /** Active memberships on this class. */
  members: number;
  /** Paused, leaving, or never paid — on the class, but not in the figure. */
  notCounted: number;
};

const NOT_COUNTED = new Set(["paused", "cancel_scheduled", "incomplete"]);

export function classForecasts(memberships: ForecastMembership[]): Map<string, ClassForecast> {
  const out = new Map<string, ClassForecast>();
  const entry = (classId: string) => {
    let f = out.get(classId);
    if (!f) {
      f = { monthlyPence: 0, members: 0, notCounted: 0 };
      out.set(classId, f);
    }
    return f;
  };

  // One family's subscription = one group. A membership with no subscription id stands alone.
  const groups = new Map<string, ForecastMembership[]>();
  memberships.forEach((m, i) => {
    if (!m.class_id) return;
    if (m.status !== "active") {
      if (NOT_COUNTED.has(m.status)) entry(m.class_id).notCounted++;
      return;
    }
    const key = m.stripe_subscription_id ?? `__alone:${i}`;
    const g = groups.get(key) ?? [];
    g.push(m);
    groups.set(key, g);
  });

  for (const group of groups.values()) {
    const total = group.reduce((s, m) => s + poundsToPence(m.monthly_amount), 0);
    const shares = splitPence(total, group.map(() => 1));
    group.forEach((m, i) => {
      const f = entry(m.class_id as string);
      f.monthlyPence += shares[i];
      f.members++;
    });
  }
  return out;
}
