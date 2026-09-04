/**
 * Pure logic for the read-only Stripe renewal auditor
 * (scripts/stripe-billing-audit.mjs). No network, no secrets, no Stripe SDK —
 * kept separate so the repo's test suite can prove the date arithmetic and the
 * classification rules that the live audit depends on.
 *
 * Everything here is timezone-aware on purpose: the studio's billing day is a
 * LONDON calendar day, but every Stripe timestamp is a UTC instant, and the
 * anchor sits at 07:00 UTC — an hour that is the same London day in both GMT
 * and BST, but only if the comparison is done in London time.
 */

export const LONDON_TZ = "Europe/London";

/** Y-M-D + H:M as experienced in London. */
export function londonParts(date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (t) => f.find((p) => p.type === t)?.value ?? "";
  // en-CA renders midnight as "24" in some ICU builds; normalise to 00.
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { ymd: `${get("year")}-${get("month")}-${get("day")}`, hm: `${hour}:${get("minute")}` };
}

export const londonYMD = (date) => londonParts(date).ymd;

export function londonStamp(unixSeconds) {
  if (unixSeconds == null) return null;
  const p = londonParts(new Date(unixSeconds * 1000));
  return `${p.ymd} ${p.hm} ${LONDON_TZ}`;
}

/** Minutes London is ahead of UTC at the given instant (0 in GMT, 60 in BST). */
export function londonOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON_TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

/**
 * The UTC instant of London midnight starting the given calendar day.
 * Solved as a fixed point rather than by sampling noon: on the two clock-change
 * days the offset at midnight differs from the offset at midday, and a noon
 * sample would put the boundary an hour out — the exact error that would move a
 * subscription into or out of the wrong billing day.
 */
function londonMidnightUnix(y, m, d) {
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0);
  let ts = wall;
  for (let i = 0; i < 3; i++) {
    const next = wall - londonOffsetMinutes(new Date(ts)) * 60000;
    if (next === ts) break;
    ts = next;
  }
  return Math.floor(ts / 1000);
}

/** [startUnix, endUnix) spanning one whole London calendar day. */
export function londonDayBounds(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  // Date.UTC normalises d+1 across month and year ends for us.
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return [
    londonMidnightUnix(y, m, d),
    londonMidnightUnix(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  ];
}

/** The next 5th of the month in London — the studio's billing day. */
export function nextBillingDay(now = new Date()) {
  const [y, m, d] = londonYMD(now).split("-").map(Number);
  if (d < 5) return `${y}-${String(m).padStart(2, "0")}-05`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-05`;
}

/**
 * Is this subscription expected to bill on the target London day?
 * A trialing subscription's first charge lands at trial_end; an active one at
 * current_period_end. (For a trialing subscription Stripe reports the same
 * instant in both fields, so checking both is belt-and-braces, not double
 * counting — the first match wins.)
 */
export function dueOnDay(sub, dayStartUnix, dayEndUnix) {
  const anchors = [
    ["current_period_end", sub.current_period_end],
    ["trial_end", sub.trial_end],
  ].filter(([, v]) => typeof v === "number");
  const hit = anchors.find(([, v]) => v >= dayStartUnix && v < dayEndUnix);
  return hit ? { anchorField: hit[0], anchorUnix: hit[1] } : null;
}

/**
 * Stripe's payment-method precedence for an automatically collected
 * subscription invoice, most specific first. Returning the whole chain (not
 * just the winner) is deliberate: "which level supplied the card" is exactly
 * the thing that goes wrong when a SetupIntent saved a card on the Customer
 * but nothing ever set it on the Subscription.
 */
export function resolvePaymentMethod({ subscription, customer, upcomingInvoice }) {
  const idOf = (v) => (v == null ? null : typeof v === "string" ? v : v.id ?? null);
  const chain = [
    ["invoice.default_payment_method", idOf(upcomingInvoice?.default_payment_method)],
    ["subscription.default_payment_method", idOf(subscription?.default_payment_method)],
    ["invoice.default_source", idOf(upcomingInvoice?.default_source)],
    ["subscription.default_source", idOf(subscription?.default_source)],
    ["customer.invoice_settings.default_payment_method", idOf(customer?.invoice_settings?.default_payment_method)],
    ["customer.default_source", idOf(customer?.default_source)],
  ];
  const hit = chain.find(([, v]) => !!v);
  return {
    source: hit ? hit[0] : null,
    id: hit ? hit[1] : null,
    chain: chain.map(([level, value]) => ({ level, value })),
  };
}

/**
 * A card is valid through the LAST DAY of its expiry month, so it is only
 * expired once the 1st of the following month has arrived.
 */
export function cardExpired(expMonth, expYear, atUnix) {
  if (!expMonth || !expYear) return null;
  return Date.UTC(expYear, expMonth, 1) / 1000 <= atUnix;
}
