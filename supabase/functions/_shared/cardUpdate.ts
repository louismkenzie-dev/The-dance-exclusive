// The card a family pays their monthly memberships with.
//
// Jodie Cornwell, via Amie: "Jodie Cornwell has got a new card and needs to
// update her card details for her.. How do we set her back up?"
//
// She couldn't, and neither could Amie. Her card failed on 9 September, she
// was emailed that day, and there was nowhere to put the new one: the only
// card form in the whole app is inside checkout, which is no use to someone
// who is already a member. Stripe retried for eleven days, gave up, and
// cancelled both memberships on 20 September — £58.14 a month, gone, while
// Eloise carried on coming to class.
//
// So the maths that decides what a family is told about their card lives
// here, tested, and both the screen and the server read it — a card that is
// about to expire is the same problem as Jodie's, a month before it happens.

export interface CardSummary {
  brand: string | null;
  last4: string | null;
  /** 1–12, as Stripe gives it. */
  expMonth: number | null;
  expYear: number | null;
}

/** Stripe's spelling, and a parent's. */
const BRAND_NAMES: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
  eftpos_au: "Eftpos",
  link: "Link",
};

export function cardBrandName(brand: string | null | undefined): string {
  if (!brand) return "Card";
  return BRAND_NAMES[brand.toLowerCase()] ?? (brand.charAt(0).toUpperCase() + brand.slice(1));
}

/** "Visa •••• 4242 · expires 09/27" — what the family sees on their account. */
export function describeCard(card: CardSummary | null | undefined): string {
  if (!card?.last4) return "No card saved";
  const expiry = card.expMonth && card.expYear
    ? ` · expires ${String(card.expMonth).padStart(2, "0")}/${String(card.expYear).slice(-2)}`
    : "";
  return `${cardBrandName(card.brand)} •••• ${card.last4}${expiry}`;
}

export type CardHealth = "none" | "expired" | "expiring" | "ok";

/**
 * A card is good until the END of its expiry month, and we start warning a
 * month before that — enough notice to replace it before a payment is missed,
 * which is the whole point of knowing.
 */
export function cardHealth(card: CardSummary | null | undefined, now: Date): CardHealth {
  if (!card?.last4) return "none";
  if (!card.expMonth || !card.expYear) return "ok";
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // expMonth is 1-based, so passing it as a 0-based index lands on the first
  // day of the month AFTER the card expires.
  const deadAt = Date.UTC(card.expYear, card.expMonth, 1);
  if (today >= deadAt) return "expired";
  const warnFrom = Date.UTC(card.expYear, card.expMonth - 2, 1);
  return today >= warnFrom ? "expiring" : "ok";
}

/** Subscriptions a new card should be attached to. */
export const LIVE_SUB_STATUSES = ["trialing", "active", "past_due", "unpaid", "paused"];

/** Memberships that still have money to collect, so still need a good card. */
export const LIVE_MEMBERSHIP_STATUSES = ["active", "past_due", "paused", "cancel_scheduled", "incomplete"];

/** One line for the screen and the email — plain, and never alarming without cause. */
export function cardWarning(health: CardHealth, pastDue: boolean): string | null {
  if (pastDue) return "A payment didn't go through. Adding a new card is the quickest way to put it right.";
  if (health === "expired") return "The card we have on file has expired, so your next payment will fail.";
  if (health === "expiring") return "The card we have on file expires soon — worth replacing before your next payment.";
  if (health === "none") return "There's no card saved for your monthly payments yet.";
  return null;
}
