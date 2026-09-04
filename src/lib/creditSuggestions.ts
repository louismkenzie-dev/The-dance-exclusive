// Helpers for the admin "Issue credit code" flow — working out how much a
// personal credit should be worth when it stands in for something like a
// free month of a class.
import { monthlyPrice, round2, type PricedClass } from "./pricing";

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
 * prize on a class that is only sold by the term. A month is taken as four
 * sessions' worth of the term price; a class with no term price (or no
 * scheduled sessions to divide by) falls back to its monthly membership rate.
 */
export const monthValueForClass = (cls: PricedClass, sessionsInTerm: number): MonthValue => {
  const termPrice = Number(cls.price_per_term ?? 0);
  if (termPrice > 0 && sessionsInTerm > 0) {
    return {
      amount: round2((termPrice * 4) / sessionsInTerm),
      explanation: `4 of the ${sessionsInTerm} sessions in a ${gbp(termPrice)} term`,
    };
  }
  return {
    amount: monthlyPrice(cls),
    explanation: "the monthly rate for this class",
  };
};
