// Helpers for the admin "Issue credit code" flow — working out how much a
// personal credit should be worth when it stands in for something like a
// free month of a class.
import { monthlyPrice, round2, sessionPrice, type PricedClass } from "./pricing";

export { round2 };

export interface MonthValue {
  /** Suggested credit in pounds, rounded to the penny. */
  amount: number;
  /** Plain-English note on how the figure was reached, shown to the admin. */
  explanation: string;
}

/** "£104" for whole pounds, "£104.50" otherwise. */
const gbp = (n: number) => `£${Number.isInteger(n) ? n : n.toFixed(2)}`;

/**
 * What one month of a class is worth — e.g. for a "free month" referral
 * prize on a class that is only sold by the term. A month is four weekly
 * classes at the class's per-session rate (White Court Performing Arts:
 * 4 × £8 = £32 of its £104 term). This deliberately ignores the class's
 * term_start/term_end range, which often spans several school terms and
 * so can't be used to divide the term price safely. Where the studio has
 * set an explicit monthly rate it is mentioned as the alternative.
 */
export const monthValueForClass = (cls: PricedClass): MonthValue => {
  const perClass = sessionPrice(cls);
  const amount = round2(perClass * 4);
  const monthly = monthlyPrice(cls);
  const hasOwnMonthlyRate = Number(cls.price_per_month ?? 0) > 0 && Math.abs(monthly - amount) >= 0.005;
  return {
    amount,
    explanation:
      `4 weekly classes at ${gbp(perClass)}` +
      (hasOwnMonthlyRate ? ` (its monthly membership rate is ${gbp(monthly)})` : ""),
  };
};
