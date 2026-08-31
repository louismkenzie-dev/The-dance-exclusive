import type { PricingPlan } from "@/contexts/CartContext";

/**
 * Which payment plans a children's class offers. The admin switches this per
 * class (Classes → Pricing); anything unset counts as offered, so classes
 * created before the switches existed behave exactly as before.
 */
export interface PlanFlags {
  allow_monthly?: boolean | null;
  allow_termly?: boolean | null;
  allow_yearly?: boolean | null;
}

export const offersMonthly = (c: PlanFlags): boolean => c.allow_monthly !== false;
export const offersTermly = (c: PlanFlags): boolean => c.allow_termly !== false;
export const offersYearly = (c: PlanFlags): boolean => c.allow_yearly !== false;

/**
 * The plan a children's class pre-selects: monthly where it's offered,
 * otherwise termly (needs bookable sessions), otherwise yearly. Falls back to
 * termly-then-monthly so something is always selected even on odd data.
 */
export const defaultChildPlan = (c: PlanFlags, hasTermSessions: boolean): PricingPlan => {
  if (offersMonthly(c)) return "monthly";
  if (offersTermly(c) && hasTermSessions) return "term";
  if (offersYearly(c)) return "yearly";
  return offersTermly(c) ? "term" : "monthly";
};
