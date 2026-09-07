/**
 * Plain-English framing for the errors Stripe hands back at the moment of
 * paying. The real message is never thrown away: it becomes the body when
 * we have nothing better, and the `detail` line when the translation is
 * only a summary of it.
 */

export interface FriendlyPaymentError {
  title: string;
  body: string;
  /** The raw message, kept when it says more than the translation. */
  detail?: string;
}

interface Translation {
  title: string;
  body: string;
  /** Stripe error / decline codes that select this translation. */
  codes: string[];
  /** Message text that selects this translation when no code is known. */
  match: RegExp;
  /** Raw messages that say nothing beyond the translation — dropped. */
  redundant: RegExp;
}

const TRANSLATIONS: Translation[] = [
  {
    title: "Not enough funds on this card",
    body: "The bank declined the payment because the card doesn't have enough available balance. Try another card.",
    codes: ["insufficient_funds"],
    match: /insufficient funds/i,
    redundant: /^your card has insufficient funds\.?$/i,
  },
  {
    title: "This card has expired",
    body: "Check the expiry date, or use a different card.",
    codes: ["expired_card"],
    match: /expired/i,
    redundant: /^your card has expired\.?$/i,
  },
  {
    title: "The security code doesn't match",
    body: "Check the three-digit code on the back of your card (four digits on the front for American Express) and try again.",
    codes: ["incorrect_cvc", "invalid_cvc"],
    match: /security code|\bcvc\b/i,
    redundant: /^your card'?s security code is (incorrect|invalid|incomplete)\.?$/i,
  },
  {
    title: "The card number doesn't look right",
    body: "Check the long number on the front of the card and try again.",
    codes: ["incorrect_number", "invalid_number"],
    match: /card number/i,
    redundant: /^your card number is (incorrect|invalid|incomplete)\.?$/i,
  },
  {
    title: "The expiry date doesn't look right",
    body: "Check the month and year printed on the card and try again.",
    codes: ["invalid_expiry_month", "invalid_expiry_year", "invalid_expiry_year_past"],
    match: /expir(y|ation) (month|year|date)/i,
    redundant: /^your card'?s expiration (month|year|date) is (invalid|in the past|incomplete)\.?$/i,
  },
  {
    title: "We couldn't confirm it was you",
    body: "Your bank asked for extra verification and it didn't complete. Try again and follow your bank's prompts, or use a different card.",
    codes: ["authentication_required", "payment_intent_authentication_failure", "setup_intent_authentication_failure"],
    match: /authenticat|3d secure|3-d secure|verification/i,
    redundant: /^(we are unable to authenticate your payment method\.?.*|your card was declined\.? this transaction requires authentication\.?)$/i,
  },
  {
    title: "Something went wrong at the bank",
    body: "Nothing has been charged. Wait a moment and try again, or use a different card.",
    codes: ["processing_error", "try_again_later", "reenter_transaction", "issuer_not_available"],
    match: /error occurred while processing|try again (later|in a little bit)/i,
    redundant: /^an error occurred while processing your card\.? try again in a little bit\.?$/i,
  },
  {
    title: "Your card was declined",
    body: "Your bank didn't approve the payment. Try another card, or contact your bank to find out why.",
    codes: ["card_declined", "generic_decline", "do_not_honor", "transaction_not_allowed", "card_not_supported", "call_issuer", "lost_card", "stolen_card", "pickup_card", "fraudulent", "merchant_blacklist", "security_violation"],
    match: /declined|not supported|do not honou?r/i,
    redundant: /^your card (was declined|does not support this type of purchase|has been declined)\.?$/i,
  },
  {
    title: "Connection problem",
    body: "We couldn't reach the payment provider. Check your connection and try again — nothing has been charged.",
    codes: ["api_connection_error", "network_error", "timeout"],
    match: /network|timed? ?out|failed to fetch|connection|offline|load failed/i,
    redundant: /^(network error|failed to fetch|load failed|the request timed out)\.?$/i,
  },
  // Our own pre-flight checks pass through the same surface.
  {
    title: "Add your home address first",
    body: "",
    codes: [],
    match: /home address/i,
    redundant: /$^/,
  },
  {
    title: "Please accept the terms first",
    body: "",
    codes: [],
    match: /terms (&|and) conditions/i,
    redundant: /$^/,
  },
];

const clean = (s: string | null | undefined): string => (s ?? "").trim();

/**
 * Translate a Stripe (or our own) payment error into a title + body, keeping
 * the raw message as `detail` whenever it adds information. Unknown errors
 * get a neutral title and the raw message as the body, so the parent always
 * sees the real reason.
 */
export function friendlyPaymentError(raw: string, code?: string): FriendlyPaymentError {
  const message = clean(raw);
  const key = clean(code).toLowerCase();

  const translation =
    (key && TRANSLATIONS.find((t) => t.codes.includes(key))) ||
    (message && TRANSLATIONS.find((t) => t.match.test(message))) ||
    null;

  if (!translation) {
    return { title: "Payment didn't go through", body: message || "Please try again." };
  }

  // Translations with no body of their own show the raw message as the body.
  if (!translation.body) {
    return { title: translation.title, body: message || translation.title };
  }

  const detail = message && !translation.redundant.test(message) ? message : undefined;
  return { title: translation.title, body: translation.body, ...(detail ? { detail } : {}) };
}
