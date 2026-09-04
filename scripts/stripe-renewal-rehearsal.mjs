#!/usr/bin/env node
/**
 * SANDBOX-ONLY renewal rehearsal using Stripe Test Clocks.
 * ---------------------------------------------------------------------------
 * Reproduces production's monthly-membership shape (direct charge on the
 * connected account, recurring price, trial anchored to the 5th, £0-today
 * SetupIntent variant) and fast-forwards a test clock through a renewal, so
 * the success / decline / insufficient-funds / 3-D-Secure / expired-card
 * outcomes can be observed end to end before a live billing run.
 *
 * SAFETY CONTRACT
 *   - Refuses to start unless the key is a TEST key (sk_test_/rk_test_) AND
 *     every object it touches reports livemode:false. There is no flag that
 *     relaxes this.
 *   - Only ever touches objects it created itself, all tagged with
 *     metadata.rehearsal_run = <run id>.
 *   - Never reads or modifies anything belonging to a real parent.
 *   - `--cleanup=<runId>` cancels the test clock it created (which removes the
 *     customers and subscriptions attached to it) and nothing else.
 *
 * USAGE
 *   STRIPE_API_KEY=sk_test_… STRIPE_CONNECTED_ACCOUNT_ID=acct_… \
 *     node scripts/stripe-renewal-rehearsal.mjs --scenario=success
 *
 *   Scenarios: success | decline | insufficient_funds | auth_required |
 *              expired_card | no_payment_method | setup_intent_flow | all
 *
 *   Add --webhook-url=https://<ref>.supabase.co/functions/v1/payments-webhook?env=sandbox
 *   to have the run print the events Stripe would deliver, so duplicate and
 *   out-of-order delivery can be replayed with `stripe events resend <id>`.
 *
 * WHY A TEST CLOCK: it is the only way to see a real renewal invoice, its
 * PaymentIntent, and the resulting webhook events without waiting a month or
 * touching a live card.
 */

const STRIPE_API_VERSION = "2025-02-24.acacia"; // must match _shared/stripe.ts
const STRIPE_BASE = "https://api.stripe.com";

const argv = process.argv.slice(2);
const flag = (n, d = null) => {
  const hit = argv.find((a) => a === `--${n}` || a.startsWith(`--${n}=`));
  if (!hit) return d;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};

const KEY = process.env.STRIPE_API_KEY || process.env.STRIPE_SANDBOX_API_KEY || "";
const ACCOUNT = process.env.STRIPE_CONNECTED_ACCOUNT_ID || process.env.STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID || "";
const PLATFORM_FEE_PERCENT = Number(process.env.PLATFORM_FEE_PERCENT ?? 1);

if (!/^(sk|rk)_test_/.test(KEY)) {
  console.error(
    "REFUSED: this rehearsal runs in Stripe TEST MODE ONLY. STRIPE_API_KEY must start " +
    "with sk_test_ or rk_test_. There is no override — never point it at live data.",
  );
  process.exit(2);
}
if (!ACCOUNT.startsWith("acct_")) {
  console.error("REFUSED: set STRIPE_CONNECTED_ACCOUNT_ID to the TEST-MODE connected account (acct_…).");
  process.exit(2);
}

// Stripe's documented test cards, by the behaviour we need to rehearse.
const CARDS = {
  success: "4242424242424242",
  decline: "4000000000000002",            // generic_decline
  insufficient_funds: "4000000000009995",
  auth_required: "4000002500003155",      // requires authentication on every charge
  // Charges succeed at setup, then fail when charged off-session — the closest
  // stand-in for "card replaced / expired since checkout".
  expired_card: "4000000000000069",
};

const SCENARIOS = {
  success: { card: "success", expect: "invoice.paid → membership stays active, current_period_end rolls forward" },
  decline: { card: "decline", expect: "invoice.payment_failed → membership past_due, hosted invoice URL available" },
  insufficient_funds: { card: "insufficient_funds", expect: "invoice.payment_failed (card_declined/insufficient_funds) → past_due" },
  auth_required: { card: "auth_required", expect: "invoice.payment_action_required → parent must authenticate; invoice stays open" },
  expired_card: { card: "expired_card", expect: "invoice.payment_failed at renewal even though setup succeeded" },
  no_payment_method: { card: null, expect: "invoice.payment_failed with no PM — the RED case the auditor flags" },
  setup_intent_flow: { card: "success", setupOnly: true, expect: "£0 today, card saved, default_payment_method set, first charge at trial end" },
};

let calls = 0;
async function api(method, path, form = null, { account = ACCOUNT, idempotencyKey = null } = {}) {
  calls++;
  const headers = {
    Authorization: `Bearer ${KEY}`,
    "Stripe-Version": STRIPE_API_VERSION,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (account) headers["Stripe-Account"] = account;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const body = form ? encodeForm(form) : undefined;
  const res = await fetch(`${STRIPE_BASE}${path}`, { method, headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${json?.error?.message || res.status}`);
    err.code = json?.error?.code;
    err.declineCode = json?.error?.decline_code;
    err.raw = json;
    throw err;
  }
  // Belt and braces: nothing this script touches may be live.
  if (json.livemode === true) {
    console.error(`ABORT: ${path} returned a LIVE object. Refusing to continue.`);
    process.exit(3);
  }
  return json;
}

function encodeForm(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => (typeof item === "object" ? encodeForm(item, `${key}[${i}]`, out) : out.append(`${key}[${i}]`, String(item))));
    else if (typeof v === "object") encodeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

const RUN_ID = typeof flag("run") === "string" ? flag("run") : `rehearsal_${Date.now()}`;
const log = (...a) => console.log(...a);

/** The 5th of next month at 07:00 UTC — the same anchor _shared/billing.ts uses. */
function anchorFrom(nowUnix) {
  const d = new Date(nowUnix * 1000);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return Math.floor(Date.UTC(ny, nm - 1, 5, 7, 0, 0) / 1000);
}

async function waitForClock(clockId, targetStatus = "ready", timeoutMs = 180_000) {
  const started = Date.now();
  for (;;) {
    const clock = await api("GET", `/v1/test_helpers/test_clocks/${clockId}`);
    if (clock.status === targetStatus) return clock;
    if (clock.status === "internal_failure") throw new Error(`Test clock ${clockId} failed internally`);
    if (Date.now() - started > timeoutMs) throw new Error(`Test clock ${clockId} did not reach '${targetStatus}' in time`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function runScenario(name) {
  const spec = SCENARIOS[name];
  if (!spec) throw new Error(`Unknown scenario '${name}'. One of: ${Object.keys(SCENARIOS).join(", ")}`);
  log(`\n════════ ${name} ════════\n  expectation: ${spec.expect}`);

  const now = Math.floor(Date.now() / 1000);
  const clock = await api("POST", "/v1/test_helpers/test_clocks", {
    frozen_time: now,
    name: `${RUN_ID}:${name}`,
  });
  log(`  test clock: ${clock.id} (frozen at ${new Date(now * 1000).toISOString()})`);

  const customer = await api("POST", "/v1/customers", {
    email: `${RUN_ID}.${name}@rehearsal.invalid`,
    name: `Rehearsal ${name}`,
    test_clock: clock.id,
    metadata: { rehearsal_run: RUN_ID, scenario: name },
  });

  // Attach a card exactly as production would: a PaymentMethod on the
  // connected account, saved for off-session use.
  let pmId = null;
  if (spec.card) {
    const pm = await api("POST", "/v1/payment_methods", {
      type: "card",
      card: { number: CARDS[spec.card], exp_month: 12, exp_year: new Date().getFullYear() + 2, cvc: "123" },
      metadata: { rehearsal_run: RUN_ID },
    });
    await api("POST", `/v1/payment_methods/${pm.id}/attach`, { customer: customer.id });
    pmId = pm.id;
    log(`  payment method: ${pm.id} (${spec.card})`);
  } else {
    log("  payment method: NONE (deliberately)");
  }

  const price = await api("POST", "/v1/prices", {
    currency: "gbp",
    unit_amount: 4200,
    recurring: { interval: "month" },
    product_data: { name: `Rehearsal Monthly Membership (${name})` },
  });

  const trialEnd = anchorFrom(now);
  const sub = await api("POST", "/v1/subscriptions", {
    customer: customer.id,
    items: [{ price: price.id }],
    trial_end: trialEnd,
    proration_behavior: "none",
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription", payment_method_types: ["card"] },
    ...(pmId && !spec.setupOnly ? { default_payment_method: pmId } : {}),
    ...(PLATFORM_FEE_PERCENT > 0 ? { application_fee_percent: PLATFORM_FEE_PERCENT } : {}),
    expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
    metadata: { rehearsal_run: RUN_ID, scenario: name, checkoutType: "membership_checkout" },
  });
  log(`  subscription: ${sub.id}  status=${sub.status}  trial_end=${new Date(trialEnd * 1000).toISOString()}`);
  log(`  default_payment_method at creation: ${sub.default_payment_method ?? "null"}`);
  if (sub.pending_setup_intent) {
    const seti = typeof sub.pending_setup_intent === "string" ? sub.pending_setup_intent : sub.pending_setup_intent.id;
    log(`  pending_setup_intent: ${seti}` +
      `  ← production relies on finalize-membership-setup copying this card onto the subscription`);
  }

  // Advance past the trial end so Stripe raises and pays the first real invoice.
  log(`  advancing clock to ${new Date((trialEnd + 3600) * 1000).toISOString()}…`);
  await api("POST", `/v1/test_helpers/test_clocks/${clock.id}/advance`, { frozen_time: trialEnd + 3600 });
  await waitForClock(clock.id);

  const after = await api("GET", `/v1/subscriptions/${sub.id}`, null);
  const invoices = await api("GET", `/v1/invoices?subscription=${sub.id}&limit=10`);
  const latest = invoices.data?.[0];
  let pi = null;
  if (latest?.payment_intent) {
    pi = await api("GET", `/v1/payment_intents/${typeof latest.payment_intent === "string" ? latest.payment_intent : latest.payment_intent.id}`);
  }

  const result = {
    scenario: name,
    testClock: clock.id,
    subscription: sub.id,
    customer: customer.id,
    subscriptionStatusAfter: after.status,
    defaultPaymentMethodAfter: after.default_payment_method ?? null,
    invoiceId: latest?.id ?? null,
    invoiceStatus: latest?.status ?? null,
    invoiceTotal: latest?.total ?? null,
    invoiceBillingReason: latest?.billing_reason ?? null,
    applicationFeeAmount: latest?.application_fee_amount ?? null,
    nextPaymentAttempt: latest?.next_payment_attempt ?? null,
    hostedInvoiceUrl: latest?.hosted_invoice_url ?? null,
    paymentIntentStatus: pi?.status ?? null,
    lastPaymentError: pi?.last_payment_error?.code ?? null,
    declineCode: pi?.last_payment_error?.decline_code ?? null,
  };
  log("  ── outcome ──");
  for (const [k, v] of Object.entries(result)) log(`    ${k}: ${v}`);
  log(`  Replay the resulting events with:  stripe events resend <event_id> --stripe-account ${ACCOUNT}`);
  log(`  Clean up with:  node scripts/stripe-renewal-rehearsal.mjs --cleanup=${clock.id}`);
  return result;
}

async function cleanup(clockId) {
  const clock = await api("GET", `/v1/test_helpers/test_clocks/${clockId}`);
  if (clock.livemode) { console.error("REFUSED: that clock is live."); process.exit(3); }
  await api("DELETE", `/v1/test_helpers/test_clocks/${clockId}`);
  log(`Deleted test clock ${clockId} and every customer/subscription attached to it.`);
}

async function main() {
  const cleanupId = flag("cleanup");
  if (typeof cleanupId === "string") return cleanup(cleanupId);

  const want = typeof flag("scenario") === "string" ? flag("scenario") : "success";
  const names = want === "all" ? Object.keys(SCENARIOS) : [want];

  log(`Stripe renewal rehearsal — TEST MODE ONLY.  run=${RUN_ID}  account=${ACCOUNT}`);
  log(`API version: ${STRIPE_API_VERSION}   application_fee_percent: ${PLATFORM_FEE_PERCENT}`);

  const results = [];
  for (const n of names) {
    try { results.push(await runScenario(n)); }
    catch (e) { log(`  SCENARIO FAILED: ${n} — ${e.message}`); results.push({ scenario: n, error: e.message }); }
  }

  log(`\n════════ summary (${calls} API calls) ════════`);
  for (const r of results) {
    log(`  ${String(r.scenario).padEnd(20)} sub=${r.subscriptionStatusAfter ?? "-"} invoice=${r.invoiceStatus ?? "-"} pi=${r.paymentIntentStatus ?? "-"} ${r.lastPaymentError ? `(${r.lastPaymentError}${r.declineCode ? `/${r.declineCode}` : ""})` : ""}`);
  }
  log(`\nNow check the application state for each subscription id above:`);
  log(`  select status, current_period_end, updated_at from memberships where stripe_subscription_id = '<sub_id>';`);
  log(`Then replay one delivered event twice (duplicate delivery) and confirm no second booking is created.`);
}

main().catch((e) => { console.error(`REHEARSAL FAILED: ${e.message}`); process.exit(3); });
