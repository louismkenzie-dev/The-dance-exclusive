#!/usr/bin/env node
/**
 * READ-ONLY Stripe Billing / Stripe Connect renewal auditor.
 * ---------------------------------------------------------------------------
 * Answers one question: will every monthly membership that should renew on a
 * given date actually be ATTEMPTED by Stripe, and is our configuration capable
 * of processing the result?
 *
 * SAFETY CONTRACT (enforced in code, not just by convention):
 *   - Every Stripe call goes through `stripeGet()`, which hard-codes GET and
 *     throws if anything asks for another method. There is no write path here.
 *   - No object is created, updated, cancelled, paused, re-dated or confirmed.
 *   - No test charge, no PaymentIntent confirmation, no invoice finalisation.
 *   - Secrets are read from the environment only, never from argv or source,
 *     and are never printed (only the key TYPE, e.g. "rk_live_…", is shown).
 *
 * USAGE
 *   STRIPE_API_KEY=rk_live_… \
 *   STRIPE_CONNECTED_ACCOUNT_ID=acct_… \
 *   node scripts/stripe-billing-audit.mjs --date=2026-09-05
 *
 *   Optional database reconciliation (Phase 6):
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
 *   node scripts/stripe-billing-audit.mjs --date=2026-09-05 --reconcile
 *
 * FLAGS
 *   --date=YYYY-MM-DD   Billing date to audit, in Europe/London. Default: the
 *                       next 5th of the month.
 *   --reconcile         Also read `memberships`/`profiles` from Supabase and
 *                       perform the two-way reconciliation.
 *   --platform-scan     Also list subscriptions on the PLATFORM account, to
 *                       catch objects created in the wrong account context.
 *   --json[=FILE]       Emit the full machine-readable result (stdout or FILE).
 *   --csv=FILE          Write the per-subscription table as CSV.
 *   --all-statuses      Sweep every subscription status, not just live ones
 *                       (slower; needed for the "unexpectedly cancelled" check).
 *
 * MINIMUM STRIPE RESTRICTED-KEY PERMISSIONS (all READ):
 *   Core:      Customers(r), PaymentMethods(r), Products(r), Prices(r),
 *              Charges/PaymentIntents(r), Balance(r)
 *   Billing:   Subscriptions(r), Invoices(r), Credit notes(r), Coupons(r),
 *              Customer portal(r) [optional]
 *   Connect:   Connected accounts(r)  ← needed for the capability check
 *   Webhooks:  Webhook endpoints(r)   ← needed for the webhook audit
 *   The key must be created on the PLATFORM account (the account that owns the
 *   API keys used by the edge functions), because this integration uses DIRECT
 *   charges via the Stripe-Account header.
 */

// ───────────────────────────── safety rails ─────────────────────────────────

const FORBIDDEN_ARGS = [
  "--write", "--mutate", "--fix", "--apply", "--repair", "--charge",
  "--pay", "--cancel", "--pause", "--resume", "--retry", "--confirm",
  "--create", "--update", "--delete", "--force",
];
for (const arg of process.argv.slice(2)) {
  const bare = arg.split("=")[0];
  if (FORBIDDEN_ARGS.includes(bare)) {
    console.error(
      `REFUSED: ${bare} is not supported. This auditor is READ-ONLY by design and ` +
      `will never create, modify, cancel or charge anything in Stripe.`,
    );
    process.exit(2);
  }
}

// ───────────────────────────── configuration ────────────────────────────────

/**
 * Pinned to match supabase/functions/_shared/stripe.ts. The production code
 * deliberately pins the last pre-"Basil" version because its subscription flow
 * relies on `subscription.current_period_end`, `invoice.subscription` and
 * `invoice.payment_intent`, all of which Basil removed. The audit MUST speak
 * the same dialect as production, otherwise it would report on fields the
 * running code never sees.
 */
import {
  LONDON_TZ,
  cardExpired,
  dueOnDay,
  londonDayBounds,
  londonStamp,
  londonYMD,
  nextBillingDay,
  resolvePaymentMethod,
} from "./lib/renewalAuditCore.mjs";

const STRIPE_API_VERSION = "2025-02-24.acacia";
const STRIPE_BASE = "https://api.stripe.com";

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const eq = hit.indexOf("=");
  return eq === -1 ? true : hit.slice(eq + 1);
};

const SECRET_KEY =
  process.env.STRIPE_API_KEY ||
  process.env.STRIPE_LIVE_API_KEY ||
  process.env.STRIPE_SANDBOX_API_KEY ||
  "";
const CONNECTED_ACCOUNT =
  process.env.STRIPE_CONNECTED_ACCOUNT_ID ||
  process.env.STRIPE_LIVE_CONNECTED_ACCOUNT_ID ||
  process.env.STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID ||
  "";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const DO_RECONCILE = !!flag("reconcile");
const DO_PLATFORM_SCAN = !!flag("platform-scan");
const ALL_STATUSES = !!flag("all-statuses");
const JSON_OUT = flag("json");
const CSV_OUT = flag("csv");

if (!SECRET_KEY) {
  console.error(
    "MISSING CREDENTIAL: set STRIPE_API_KEY (preferred: a RESTRICTED key, rk_live_…, " +
    "with the read-only permissions listed in this file's header).",
  );
  process.exit(2);
}
if (!/^(sk|rk)_(live|test)_/.test(SECRET_KEY)) {
  console.error("MISSING CREDENTIAL: STRIPE_API_KEY does not look like a Stripe secret/restricted key.");
  process.exit(2);
}
/** Key TYPE only — the key itself is never printed or logged. */
const KEY_TYPE = SECRET_KEY.slice(0, SECRET_KEY.indexOf("_", 3) + 1) + "…";
const KEY_IS_LIVE = SECRET_KEY.includes("_live_");
const KEY_IS_RESTRICTED = SECRET_KEY.startsWith("rk_");

if (!CONNECTED_ACCOUNT.startsWith("acct_")) {
  console.error(
    "MISSING CREDENTIAL: set STRIPE_CONNECTED_ACCOUNT_ID to The Dance Exclusive's " +
    "connected account id (acct_…). Without it the audit cannot enter the account " +
    "context that actually owns the subscriptions.",
  );
  process.exit(2);
}

// ───────────────────────── London date arithmetic ───────────────────────────
// Shared with the repo's test suite (src/lib/renewalAuditCore.test.ts) so the
// date maths this whole audit rests on is covered by `npm test`.

const TARGET_DATE = typeof flag("date") === "string" ? flag("date") : nextBillingDay();
if (!/^\d{4}-\d{2}-\d{2}$/.test(TARGET_DATE)) {
  console.error(`Invalid --date=${TARGET_DATE} (expected YYYY-MM-DD).`);
  process.exit(2);
}
const [DAY_START, DAY_END] = londonDayBounds(TARGET_DATE);

// ─────────────────────────── read-only transport ────────────────────────────

let apiCalls = 0;
/** The single door to Stripe. GET only — there is no other request helper. */
async function stripeGet(path, { params = {}, account = null, expand = [] } = {}) {
  const qs = new URLSearchParams();
  const put = (key, value) => {
    if (value === undefined || value === null) return;
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) put(`${key}[${k}]`, v);
    } else {
      qs.append(key, String(value));
    }
  };
  for (const [k, v] of Object.entries(params)) put(k, v);
  expand.forEach((e, i) => qs.append(`expand[${i}]`, e));

  const url = `${STRIPE_BASE}${path}${qs.toString() ? `?${qs}` : ""}`;
  const headers = {
    Authorization: `Bearer ${SECRET_KEY}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };
  if (account) headers["Stripe-Account"] = account;

  let lastErr = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    apiCalls++;
    let res;
    try {
      res = await fetch(url, { method: "GET", headers }); // GET is not a variable.
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      continue;
    }
    observedApiVersion ??= res.headers.get("stripe-version") || null;
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(body?.error?.message || `HTTP ${res.status}`);
      err.statusCode = res.status;
      err.code = body?.error?.code;
      err.type = body?.error?.type;
      throw err;
    }
    return body;
  }
  throw lastErr ?? new Error("Stripe request failed");
}

let observedApiVersion = null;

async function stripeList(path, { params = {}, account = null, expand = [], limit = 100, cap = 5000 } = {}) {
  const out = [];
  let startingAfter = null;
  for (;;) {
    const page = await stripeGet(path, {
      params: { ...params, limit, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      account, expand,
    });
    out.push(...(page.data ?? []));
    if (!page.has_more || out.length >= cap) break;
    startingAfter = page.data[page.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return out;
}

/** Supabase PostgREST read (GET only). */
async function supabaseSelect(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Supabase ${table} read failed: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// ────────────────────────────── audit helpers ───────────────────────────────

const money = (pence, currency = "gbp") =>
  pence == null ? null : `${currency.toUpperCase()} ${(pence / 100).toFixed(2)}`;

const idOf = (v) => (v == null ? null : typeof v === "string" ? v : v.id ?? null);

// ────────────────────────────────── main ────────────────────────────────────

const report = {
  meta: {
    generatedAt: new Date().toISOString(),
    targetDateLondon: TARGET_DATE,
    londonDayWindowUnix: [DAY_START, DAY_END],
    londonDayWindowIso: [new Date(DAY_START * 1000).toISOString(), new Date(DAY_END * 1000).toISOString()],
    stripeApiVersionRequested: STRIPE_API_VERSION,
    stripeApiVersionObserved: null,
    keyType: KEY_TYPE,
    keyIsLiveMode: KEY_IS_LIVE,
    keyIsRestricted: KEY_IS_RESTRICTED,
    connectedAccountId: CONNECTED_ACCOUNT,
    readOnly: true,
  },
  account: null,
  webhooks: null,
  subscriptions: [],
  totals: null,
  reconciliation: null,
  platformScan: null,
  warnings: [],
};

const warn = (m) => { report.warnings.push(m); console.error(`  ! ${m}`); };

async function auditAccount() {
  console.error("→ Connected account capabilities…");
  let acct = null;
  try {
    acct = await stripeGet(`/v1/accounts/${CONNECTED_ACCOUNT}`);
  } catch (e) {
    warn(`Could not read /v1/accounts/${CONNECTED_ACCOUNT} (${e.message}). ` +
      `Grant the restricted key "Connected accounts: read" for the capability audit.`);
  }
  let balanceReachable = false;
  try {
    await stripeGet("/v1/balance", { account: CONNECTED_ACCOUNT });
    balanceReachable = true;
  } catch (e) {
    warn(`Could not read the connected account's balance (${e.message}) — the ` +
      `Stripe-Account context may be wrong or the key lacks access.`);
  }
  report.account = {
    id: acct?.id ?? CONNECTED_ACCOUNT,
    reachableViaStripeAccountHeader: balanceReachable,
    type: acct?.type ?? null,
    country: acct?.country ?? null,
    defaultCurrency: acct?.default_currency ?? null,
    chargesEnabled: acct?.charges_enabled ?? null,
    payoutsEnabled: acct?.payouts_enabled ?? null,
    detailsSubmitted: acct?.details_submitted ?? null,
    cardPaymentsCapability: acct?.capabilities?.card_payments ?? null,
    transfersCapability: acct?.capabilities?.transfers ?? null,
    disabledReason: acct?.requirements?.disabled_reason ?? null,
    currentlyDue: acct?.requirements?.currently_due ?? null,
    pastDue: acct?.requirements?.past_due ?? null,
    currentDeadline: acct?.requirements?.current_deadline ?? null,
    futureRequirements: acct?.future_requirements?.currently_due ?? null,
  };
}

/**
 * Events this integration genuinely needs, and why. `invoice.payment_failed`
 * and `invoice.payment_action_required` are the ones a renewal run cannot do
 * without: without them nothing in the database learns that a card was
 * declined or needs 3-D Secure until the next daily maintenance sweep.
 */
const REQUIRED_EVENTS = {
  "payment_intent.succeeded": "the ONLY event that fulfils a paid renewal invoice today",
  "invoice.paid": "renewal confirmation + party deposits/balances",
  "invoice.payment_failed": "a declined renewal — without it nothing marks the membership past_due or emails the parent until the next cron run",
  "invoice.payment_action_required": "renewal needs 3-D Secure — without it the parent is never prompted",
  "customer.subscription.deleted": "subscription ended in Stripe (or by dunning) — keeps the register in step",
  "customer.subscription.updated": "status/pause/price changes made outside our own code",
};

async function auditWebhooks() {
  console.error("→ Webhook endpoints…");
  const out = { platformEndpoints: [], connectEndpoints: [], connectedAccountEndpoints: [], readable: true, assessment: [] };
  try {
    const eps = await stripeList("/v1/webhook_endpoints", {});
    for (const ep of eps) {
      const row = {
        id: ep.id,
        url: ep.url,
        status: ep.status,
        apiVersion: ep.api_version,
        connect: !!ep.application === false ? ep.connect ?? null : ep.connect ?? null,
        enabledEvents: ep.enabled_events,
        livemode: ep.livemode,
        description: ep.description ?? null,
      };
      (ep.connect ? out.connectEndpoints : out.platformEndpoints).push(row);
    }
  } catch (e) {
    out.readable = false;
    warn(`Could not list webhook endpoints (${e.message}). Grant "Webhook endpoints: read".`);
  }
  // Endpoints registered directly ON the connected account would receive the
  // events instead of the platform — worth knowing about either way.
  try {
    const eps = await stripeList("/v1/webhook_endpoints", { account: CONNECTED_ACCOUNT });
    out.connectedAccountEndpoints = eps.map((ep) => ({
      id: ep.id, url: ep.url, status: ep.status, apiVersion: ep.api_version,
      enabledEvents: ep.enabled_events, livemode: ep.livemode,
    }));
  } catch { /* connected-account endpoint listing is optional */ }

  // Assess the endpoints that could serve tomorrow's renewals.
  const candidates = [...out.connectEndpoints, ...out.platformEndpoints, ...out.connectedAccountEndpoints]
    .filter((ep) => /payments-webhook/.test(ep.url ?? ""));
  if (candidates.length === 0) {
    out.assessment.push({ level: "RED", note: "No payments-webhook endpoint found in this account — nothing will process renewal results." });
  }
  for (const ep of candidates) {
    const events = new Set(ep.enabledEvents ?? []);
    const wildcard = events.has("*");
    const missing = Object.entries(REQUIRED_EVENTS)
      .filter(([e]) => !wildcard && !events.has(e))
      .map(([e, why]) => ({ event: e, why }));
    const isConnect = out.connectEndpoints.some((c) => c.id === ep.id);
    const envParam = /[?&]env=(live|sandbox)/.exec(ep.url ?? "")?.[1] ?? null;
    const expectedEnv = KEY_IS_LIVE ? "live" : "sandbox";
    const notes = [];
    if (ep.status !== "enabled") notes.push({ level: "RED", note: `endpoint status is '${ep.status}'` });
    if (!isConnect && !out.connectedAccountEndpoints.some((c) => c.id === ep.id)) {
      notes.push({
        level: "RED",
        note: "endpoint is NOT a Connect endpoint — direct charges raise events on the CONNECTED account, " +
          "so a platform-only endpoint receives nothing for these renewals",
      });
    }
    if (envParam !== expectedEnv) {
      notes.push({
        level: "RED",
        note: `url must end in ?env=${expectedEnv} (found ${envParam ?? "no env parameter"}) — the handler picks its ` +
          `signing secret from that query parameter and defaults to 'sandbox', so every delivery would fail signature verification`,
      });
    }
    if (ep.livemode !== KEY_IS_LIVE) notes.push({ level: "RED", note: `endpoint livemode=${ep.livemode} does not match the key's mode` });
    // invoice.created is a HAZARD here, not a requirement: while any endpoint
    // subscribes to it Stripe holds the draft invoice waiting for a 2xx before
    // auto-finalising it. This handler has no invoice.created case and returns
    // 400 on any signature problem, so subscribing to it could stall every
    // renewal invoice for up to 72 hours.
    if (wildcard || events.has("invoice.created")) {
      notes.push({
        level: "RED",
        note: "subscribed to invoice.created (directly or via '*') — Stripe delays auto-finalisation of every " +
          "renewal invoice until this endpoint returns 2xx, and this handler has no invoice.created case",
      });
    }
    if (missing.length) notes.push({ level: "AMBER", note: `not subscribed to: ${missing.map((m) => m.event).join(", ")}` });
    out.assessment.push({ endpoint: ep.id, url: ep.url, connect: isConnect, apiVersion: ep.apiVersion, missing, notes });
  }
  report.webhooks = out;
}

/** Every subscription in the connected account, so nothing can hide. */
async function loadSubscriptions() {
  console.error("→ Subscriptions on the connected account…");
  const statuses = ALL_STATUSES
    ? ["all"]
    : ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"];
  const seen = new Map();
  for (const status of statuses) {
    const subs = await stripeList("/v1/subscriptions", {
      account: CONNECTED_ACCOUNT,
      params: { status },
      expand: ["data.default_payment_method", "data.customer", "data.discounts"],
    });
    for (const s of subs) seen.set(s.id, s);
  }
  return [...seen.values()];
}

const dueOnTargetDate = (sub) => dueOnDay(sub, DAY_START, DAY_END);

async function auditSubscription(sub, due) {
  const acct = CONNECTED_ACCOUNT;
  const reasons = [];
  const red = (r) => reasons.push({ level: "RED", reason: r });
  const amber = (r) => reasons.push({ level: "AMBER", reason: r });

  const customer = typeof sub.customer === "object" && sub.customer ? sub.customer : null;
  const customerId = idOf(sub.customer);
  let customerObj = customer;
  if (!customerObj && customerId) {
    try { customerObj = await stripeGet(`/v1/customers/${customerId}`, { account: acct }); }
    catch (e) { warn(`Customer ${customerId} unreadable: ${e.message}`); }
  }
  if (customerObj?.deleted) red("Stripe Customer is deleted — no invoice can be paid");

  // Upcoming / next invoice (pre-Basil endpoint; Basil renamed it).
  let upcoming = null;
  let upcomingError = null;
  try {
    upcoming = await stripeGet("/v1/invoices/upcoming", {
      account: acct,
      params: { subscription: sub.id },
      expand: ["discounts"],
    });
  } catch (e) {
    upcomingError = `${e.code || e.statusCode || "error"}: ${e.message}`;
  }

  const pm = resolvePaymentMethod({ sub, customer: customerObj, upcomingInvoice: upcoming });
  let pmObj = null;
  let pmInConnectedAccount = null;
  let pmOnPlatformAccount = null;
  if (pm.id && pm.id.startsWith("pm_")) {
    try {
      pmObj = await stripeGet(`/v1/payment_methods/${pm.id}`, { account: acct });
      pmInConnectedAccount = true;
    } catch (e) {
      pmInConnectedAccount = false;
      // Does it exist on the PLATFORM account instead? That is the classic
      // "objects created in the wrong account" failure and is worth proving.
      try { await stripeGet(`/v1/payment_methods/${pm.id}`); pmOnPlatformAccount = true; }
      catch { pmOnPlatformAccount = false; }
      red(`Default PaymentMethod ${pm.id} is not readable in the connected account` +
        (pmOnPlatformAccount ? " but EXISTS ON THE PLATFORM ACCOUNT — wrong account context" : ` (${e.message})`));
    }
  } else if (pm.id) {
    // Legacy card/source id (card_… / src_…) rather than a PaymentMethod.
    amber(`Billing will use a legacy source (${pm.id}) rather than a PaymentMethod`);
  }

  // ── RED / AMBER classification ────────────────────────────────────────────
  if (sub.livemode !== KEY_IS_LIVE) red(`livemode mismatch: subscription.livemode=${sub.livemode} but the key is ${KEY_IS_LIVE ? "live" : "test"}`);
  if (!KEY_IS_LIVE) amber("Audit ran against TEST mode data — this is not a live-readiness result");

  if (sub.status === "canceled") red("Subscription is cancelled — Stripe will not bill it");
  if (sub.status === "incomplete") red("Subscription is 'incomplete' — its first invoice was never paid, so it will not renew");
  if (sub.status === "incomplete_expired") red("Subscription is 'incomplete_expired' — dead, will never bill");
  if (sub.status === "unpaid") red("Subscription is 'unpaid' — Stripe has stopped collecting");
  if (sub.status === "past_due") amber("Subscription is 'past_due' — an earlier invoice is still unpaid");
  if (sub.status === "paused") red("Subscription status is 'paused'");

  if (sub.pause_collection) {
    const resumes = sub.pause_collection.resumes_at;
    const resumesBeforeDue = resumes != null && resumes <= due.anchorUnix;
    if (!resumesBeforeDue) {
      red(`pause_collection is active (behavior=${sub.pause_collection.behavior}` +
        `${resumes ? `, resumes ${londonStamp(resumes)}` : ", no resume date"}) — the ` +
        `${TARGET_DATE} invoice will not be collected`);
    } else {
      amber(`pause_collection is set but resumes ${londonStamp(resumes)}, before the billing moment`);
    }
  }

  if (sub.collection_method !== "charge_automatically") {
    red(`collection_method is '${sub.collection_method}' — Stripe will send an invoice instead of charging the card`);
  }

  if (sub.cancel_at_period_end) {
    // A subscription cancelling AT the period end is not renewed: Stripe ends
    // it at that instant instead of raising the next invoice. If that instant
    // is the target billing day, there is no charge at all.
    if (sub.current_period_end >= DAY_START && sub.current_period_end < DAY_END) {
      red("cancel_at_period_end is set and the period ends on the target date — Stripe will end the subscription instead of billing it");
    } else {
      amber("cancel_at_period_end is set — this is the final billing period");
    }
  }
  if (sub.cancel_at) {
    if (sub.cancel_at <= due.anchorUnix) red(`cancel_at (${londonStamp(sub.cancel_at)}) falls on or before the billing moment — the subscription ends first`);
    else amber(`Scheduled to cancel at ${londonStamp(sub.cancel_at)}`);
  }

  if (sub.status === "trialing") {
    if (sub.trial_end == null) red("Status is 'trialing' with no trial_end");
    else if (sub.trial_end >= DAY_END) amber(`Still trialing past the target date (trial ends ${londonStamp(sub.trial_end)}) — no charge on ${TARGET_DATE}`);
  }

  if (!pm.id) {
    red("No usable payment method: nothing set at subscription, customer or invoice level");
  } else if (pmObj) {
    const pmCustomer = idOf(pmObj.customer);
    if (!pmCustomer) red(`PaymentMethod ${pm.id} is not attached to any Customer`);
    else if (pmCustomer !== customerId) red(`PaymentMethod ${pm.id} belongs to Customer ${pmCustomer}, not ${customerId}`);
    if (pmObj.livemode !== KEY_IS_LIVE) red(`PaymentMethod ${pm.id} livemode=${pmObj.livemode} does not match the key's mode`);

    if (pmObj.type === "card" && pmObj.card) {
      const { exp_month: em, exp_year: ey } = pmObj.card;
      if (em && ey) {
        // Cards expire at the END of their expiry month.
        const label = `${String(em).padStart(2, "0")}/${ey}`;
        if (cardExpired(em, ey, due.anchorUnix)) red(`Card expired (${label}) before the billing date`);
        else if (cardExpired(em, ey, due.anchorUnix + 60 * 24 * 3600)) amber(`Card expires within 60 days of the billing date (${label})`);
      }
      if (pmObj.card.checks?.cvc_check === "fail") amber("Card CVC check failed when saved");
    } else if (pmObj.type !== "card") {
      amber(`Payment method type is '${pmObj.type}', not a card`);
    }
  }

  const allowedTypes = sub.payment_settings?.payment_method_types;
  if (allowedTypes && pmObj && !allowedTypes.includes(pmObj.type)) {
    red(`payment_settings.payment_method_types=[${allowedTypes.join(", ")}] excludes the resolved method type '${pmObj.type}'`);
  }

  if (upcomingError) {
    red(`Stripe cannot preview the next invoice (${upcomingError}) — the renewal invoice may not generate as expected`);
  } else if (upcoming) {
    if (upcoming.total === 0) amber("Next invoice total is £0.00 — nothing will be charged");
    if (upcoming.collection_method !== "charge_automatically") red(`Upcoming invoice collection_method is '${upcoming.collection_method}'`);
    const nextAttempt = upcoming.next_payment_attempt;
    if (nextAttempt && (nextAttempt < DAY_START || nextAttempt >= DAY_END)) {
      amber(`Upcoming invoice's next_payment_attempt is ${londonStamp(nextAttempt)}, not on ${TARGET_DATE}`);
    }
  }

  if (!sub.items?.data?.length) red("Subscription has no items — there is nothing to bill");
  const zeroItems = (sub.items?.data ?? []).filter((i) => (i.price?.unit_amount ?? 0) === 0);
  if (zeroItems.length && zeroItems.length === (sub.items?.data?.length ?? 0)) amber("Every subscription item is £0.00");

  // Connect / fee configuration.
  const feePercent = sub.application_fee_percent ?? null;
  if (feePercent != null && (feePercent < 0 || feePercent > 100)) red(`application_fee_percent out of range: ${feePercent}`);

  const level = reasons.some((r) => r.level === "RED")
    ? "RED"
    : reasons.some((r) => r.level === "AMBER") ? "AMBER" : "GREEN";

  const items = (sub.items?.data ?? []).map((i) => ({
    subscriptionItemId: i.id,
    priceId: i.price?.id ?? null,
    productId: idOf(i.price?.product),
    quantity: i.quantity ?? null,
    unitAmount: i.price?.unit_amount ?? null,
    currency: i.price?.currency ?? null,
    interval: i.price?.recurring?.interval ?? null,
    intervalCount: i.price?.recurring?.interval_count ?? null,
  }));

  return {
    classification: level,
    reasons,
    stripeSubscriptionId: sub.id,
    connectedAccountId: acct,
    livemode: sub.livemode,
    testClock: idOf(sub.test_clock),
    status: sub.status,
    collectionMethod: sub.collection_method,
    stripeCustomerId: customerId,
    customerName: customerObj?.name ?? null,
    customerEmail: customerObj?.email ?? null,
    customerDeleted: !!customerObj?.deleted,
    internalUserId: sub.metadata?.userId ?? null,
    checkoutType: sub.metadata?.checkoutType ?? null,
    billingAnchorField: due.anchorField,
    nextBillingUnix: due.anchorUnix,
    nextBillingIso: new Date(due.anchorUnix * 1000).toISOString(),
    nextBillingLondon: londonStamp(due.anchorUnix),
    currentPeriodStart: londonStamp(sub.current_period_start),
    currentPeriodEnd: londonStamp(sub.current_period_end),
    billingCycleAnchor: londonStamp(sub.billing_cycle_anchor),
    trialStart: londonStamp(sub.trial_start),
    trialEnd: londonStamp(sub.trial_end),
    cancelAtPeriodEnd: !!sub.cancel_at_period_end,
    cancelAt: londonStamp(sub.cancel_at),
    canceledAt: londonStamp(sub.canceled_at),
    pauseCollection: sub.pause_collection ?? null,
    items,
    itemsSubtotal: items.reduce((s, i) => s + (i.unitAmount ?? 0) * (i.quantity ?? 1), 0),
    currency: items[0]?.currency ?? upcoming?.currency ?? "gbp",
    upcomingInvoice: upcoming ? {
      subtotal: upcoming.subtotal,
      total: upcoming.total,
      amountDue: upcoming.amount_due,
      currency: upcoming.currency,
      billingReason: upcoming.billing_reason,
      collectionMethod: upcoming.collection_method,
      periodStart: londonStamp(upcoming.period_start),
      periodEnd: londonStamp(upcoming.period_end),
      nextPaymentAttempt: londonStamp(upcoming.next_payment_attempt),
      applicationFeeAmount: upcoming.application_fee_amount ?? null,
      discounts: (upcoming.discounts ?? []).map((d) => (typeof d === "string" ? d : {
        id: d.id, coupon: d.coupon?.id ?? null,
        percentOff: d.coupon?.percent_off ?? null, amountOff: d.coupon?.amount_off ?? null,
      })),
    } : null,
    upcomingInvoiceError: upcomingError,
    expectedChargePence: upcoming ? upcoming.amount_due : items.reduce((s, i) => s + (i.unitAmount ?? 0) * (i.quantity ?? 1), 0),
    applicationFeePercent: feePercent,
    onBehalfOf: idOf(sub.on_behalf_of),
    transferData: sub.transfer_data ?? null,
    subscriptionDiscounts: (sub.discounts ?? []).map((d) => (typeof d === "string" ? d : d.id)),
    paymentMethod: {
      resolvedFrom: pm.source,
      id: pm.id,
      precedenceChain: pm.chain,
      type: pmObj?.type ?? null,
      cardBrand: pmObj?.card?.brand ?? null,
      cardLast4: pmObj?.card?.last4 ?? null,
      cardExpMonth: pmObj?.card?.exp_month ?? null,
      cardExpYear: pmObj?.card?.exp_year ?? null,
      cardCountry: pmObj?.card?.country ?? null,
      attachedToCustomer: pmObj ? idOf(pmObj.customer) : null,
      belongsToSubscriptionCustomer: pmObj ? idOf(pmObj.customer) === customerId : null,
      existsInConnectedAccount: pmInConnectedAccount,
      existsOnPlatformAccount: pmOnPlatformAccount,
      livemode: pmObj?.livemode ?? null,
    },
    subscriptionMetadata: sub.metadata ?? {},
  };
}

async function reconcile(audited, allSubs) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    warn("--reconcile requested but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set; skipping the database side.");
    return null;
  }
  console.error("→ Database reconciliation…");
  const memberships = await supabaseSelect(
    "memberships",
    "select=id,user_id,student_id,class_id,stripe_subscription_id,stripe_subscription_item_id," +
    "stripe_price_id,monthly_amount,status,stripe_env,free_month,stripe_setup_intent_id," +
    "current_period_end,cancel_at,cancelled_at,created_at&limit=10000",
  );
  const userIds = [...new Set(memberships.map((m) => m.user_id).filter(Boolean))];
  const profiles = userIds.length
    ? await supabaseSelect("profiles", `select=user_id,full_name,email,stripe_customer_id&user_id=in.(${userIds.join(",")})&limit=10000`)
    : [];
  const profileByUser = new Map(profiles.map((p) => [p.user_id, p]));
  const appSettings = await supabaseSelect("app_settings", "select=key,value,updated_at&key=eq.payments_mode").catch(() => []);
  const paymentsMode = appSettings?.[0]?.value ?? null;

  const envWanted = KEY_IS_LIVE ? "live" : "sandbox";
  const relevant = memberships.filter((m) => m.stripe_env === envWanted);
  const stripeById = new Map(allSubs.map((s) => [s.id, s]));
  const auditedById = new Map(audited.map((a) => [a.stripeSubscriptionId, a]));

  const LIVE_DB_STATUSES = ["active", "past_due", "paused", "cancel_scheduled"];

  const dbWithoutStripe = [];
  const statusMismatch = [];
  const dateMismatch = [];
  const amountMismatch = [];
  const priceMismatch = [];
  for (const m of relevant) {
    const sub = stripeById.get(m.stripe_subscription_id);
    const prof = profileByUser.get(m.user_id);
    const base = {
      membershipId: m.id, userId: m.user_id, email: prof?.email ?? null, name: prof?.full_name ?? null,
      dbStatus: m.status, stripeSubscriptionId: m.stripe_subscription_id,
    };
    if (!sub) {
      if (LIVE_DB_STATUSES.includes(m.status)) dbWithoutStripe.push({ ...base, note: "no matching Stripe subscription in this account/mode" });
      continue;
    }
    const stripeLive = ["active", "trialing", "past_due", "unpaid"].includes(sub.status);
    if (LIVE_DB_STATUSES.includes(m.status) && !stripeLive) {
      statusMismatch.push({ ...base, stripeStatus: sub.status, note: "active internally but not collectible in Stripe" });
    }
    if (!LIVE_DB_STATUSES.includes(m.status) && m.status !== "incomplete" && stripeLive) {
      statusMismatch.push({ ...base, stripeStatus: sub.status, note: "inactive internally but live in Stripe" });
    }
    if (m.current_period_end && sub.current_period_end) {
      const dbDay = londonYMD(new Date(m.current_period_end));
      const stripeDay = londonYMD(new Date(sub.current_period_end * 1000));
      if (dbDay !== stripeDay) dateMismatch.push({ ...base, dbPeriodEnd: dbDay, stripePeriodEnd: stripeDay });
    }
    const item = (sub.items?.data ?? []).find((i) => i.id === m.stripe_subscription_item_id);
    if (m.stripe_subscription_item_id && !item) {
      priceMismatch.push({ ...base, note: `subscription item ${m.stripe_subscription_item_id} is not on the Stripe subscription` });
    } else if (item) {
      if (m.stripe_price_id && item.price?.id && m.stripe_price_id !== item.price.id) {
        priceMismatch.push({ ...base, dbPriceId: m.stripe_price_id, stripePriceId: item.price.id });
      }
      const dbPence = Math.round(Number(m.monthly_amount || 0) * 100);
      const stripePence = (item.price?.unit_amount ?? 0) * (item.quantity ?? 1);
      if (dbPence !== stripePence) amountMismatch.push({ ...base, dbAmount: money(dbPence), stripeAmount: money(stripePence) });
    }
    if (prof?.stripe_customer_id && idOf(sub.customer) && prof.stripe_customer_id !== idOf(sub.customer)) {
      statusMismatch.push({ ...base, note: `profiles.stripe_customer_id (${prof.stripe_customer_id}) != subscription customer (${idOf(sub.customer)})` });
    }
  }

  const dbSubIds = new Set(relevant.map((m) => m.stripe_subscription_id));
  const stripeWithoutDb = allSubs
    .filter((s) => ["active", "trialing", "past_due", "unpaid"].includes(s.status))
    .filter((s) => !dbSubIds.has(s.id))
    .map((s) => ({
      stripeSubscriptionId: s.id, status: s.status, customer: idOf(s.customer),
      metadataUserId: s.metadata?.userId ?? null, checkoutType: s.metadata?.checkoutType ?? null,
      created: londonStamp(s.created), amount: money((s.items?.data ?? []).reduce((t, i) => t + (i.price?.unit_amount ?? 0) * (i.quantity ?? 1), 0)),
      dueOnTargetDate: !!auditedById.get(s.id),
    }));

  // Duplicates: more than one collectible subscription for the same customer,
  // and more than one live membership row for the same child+class.
  const byCustomer = new Map();
  for (const s of allSubs) {
    if (!["active", "trialing", "past_due", "unpaid"].includes(s.status)) continue;
    const c = idOf(s.customer);
    if (!c) continue;
    byCustomer.set(c, [...(byCustomer.get(c) ?? []), s.id]);
  }
  const duplicateSubscriptions = [...byCustomer.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([customer, ids]) => ({ customer, subscriptionIds: ids }));

  const dupKey = new Map();
  for (const m of relevant) {
    if (!LIVE_DB_STATUSES.includes(m.status)) continue;
    const k = `${m.user_id}|${m.student_id ?? ""}|${m.class_id ?? ""}`;
    dupKey.set(k, [...(dupKey.get(k) ?? []), m]);
  }
  const duplicateMemberships = [...dupKey.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, membershipIds: rows.map((r) => r.id), subscriptionIds: [...new Set(rows.map((r) => r.stripe_subscription_id))] }));

  const custCount = new Map();
  for (const p of profiles) {
    if (!p.stripe_customer_id) continue;
    custCount.set(p.stripe_customer_id, [...(custCount.get(p.stripe_customer_id) ?? []), p.user_id]);
  }
  const sharedCustomers = [...custCount.entries()].filter(([, u]) => u.length > 1)
    .map(([customer, users]) => ({ customer, users }));

  // ── Silently-dropped card-setup signups ──────────────────────────────────
  // The August (£0-today) flow saves a card with a SetupIntent and relies on
  // the CLIENT calling finalize-membership-setup to copy that card onto the
  // subscription as its default_payment_method. Stripe does not do this by
  // itself. memberships-maintenance then cancels any trialing subscription
  // that still has no default_payment_method after 24h — so a parent whose
  // card saved fine but whose finalize call never landed is cancelled without
  // an email. This finds them: a cancelled membership whose SetupIntent
  // actually SUCCEEDED.
  const abandonedButCardSaved = [];
  const setupCandidates = relevant.filter(
    (m) => m.status === "cancelled" && m.stripe_setup_intent_id,
  );
  for (const m of setupCandidates) {
    try {
      const seti = await stripeGet(`/v1/setup_intents/${m.stripe_setup_intent_id}`, { account: CONNECTED_ACCOUNT });
      if (seti.status === "succeeded") {
        abandonedButCardSaved.push({
          membershipId: m.id, userId: m.user_id,
          email: profileByUser.get(m.user_id)?.email ?? null,
          name: profileByUser.get(m.user_id)?.full_name ?? null,
          stripeSubscriptionId: m.stripe_subscription_id,
          setupIntentId: m.stripe_setup_intent_id,
          setupIntentStatus: seti.status,
          savedPaymentMethod: idOf(seti.payment_method),
          monthlyAmount: m.monthly_amount,
          cancelledAt: m.cancelled_at,
        });
      }
    } catch (e) {
      warn(`Could not read SetupIntent ${m.stripe_setup_intent_id}: ${e.message}`);
    }
  }

  // DB rows that look live but whose Stripe subscription is NOT due on the
  // target date — the "should have renewed and won't" population.
  const dueSubIds = new Set(audited.map((a) => a.stripeSubscriptionId));
  const liveRowsNotDue = relevant
    .filter((m) => LIVE_DB_STATUSES.includes(m.status) && !dueSubIds.has(m.stripe_subscription_id))
    .map((m) => {
      const sub = stripeById.get(m.stripe_subscription_id);
      return {
        membershipId: m.id, userId: m.user_id,
        email: profileByUser.get(m.user_id)?.email ?? null,
        dbStatus: m.status, stripeSubscriptionId: m.stripe_subscription_id,
        stripeStatus: sub?.status ?? "(not found)",
        stripeNextBilling: sub ? londonStamp(sub.current_period_end) : null,
        freeMonth: m.free_month,
      };
    });

  // Free-month voiding is the one piece of OUR scheduling that can stop a
  // charge, so surface which rows are configured to skip the target month.
  const targetMonth = Number(TARGET_DATE.slice(5, 7));
  const freeMonthThisMonth = relevant
    .filter((m) => LIVE_DB_STATUSES.includes(m.status) && Number(m.free_month) === targetMonth)
    .map((m) => ({ membershipId: m.id, userId: m.user_id, email: profileByUser.get(m.user_id)?.email ?? null, freeMonth: m.free_month, stripeSubscriptionId: m.stripe_subscription_id }));

  return {
    paymentsMode,
    paymentsModeMatchesKey: paymentsMode ? (paymentsMode === envWanted) : null,
    membershipRowsTotal: memberships.length,
    membershipRowsInThisEnv: relevant.length,
    membershipRowsLive: relevant.filter((m) => LIVE_DB_STATUSES.includes(m.status)).length,
    dbWithoutStripe,
    stripeWithoutDb,
    statusMismatch,
    dateMismatch,
    amountMismatch,
    priceMismatch,
    duplicateSubscriptions,
    duplicateMemberships,
    sharedCustomers,
    abandonedButCardSaved,
    liveRowsNotDueOnTargetDate: liveRowsNotDue,
    freeMonthVoidingOnTargetMonth: freeMonthThisMonth,
    dueOnTargetDateWithMembershipRow: audited.map((a) => ({
      stripeSubscriptionId: a.stripeSubscriptionId,
      membershipIds: relevant.filter((m) => m.stripe_subscription_id === a.stripeSubscriptionId).map((m) => m.id),
      email: a.customerEmail ?? profileByUser.get(a.internalUserId)?.email ?? null,
      name: a.customerName ?? profileByUser.get(a.internalUserId)?.full_name ?? null,
    })),
  };
}

async function platformScan() {
  console.error("→ Platform-account scan (objects created in the wrong context)…");
  try {
    const subs = await stripeList("/v1/subscriptions", { params: { status: "all" }, cap: 500 });
    return {
      count: subs.length,
      membershipCheckouts: subs
        .filter((s) => s.metadata?.checkoutType === "membership_checkout")
        .map((s) => ({ id: s.id, status: s.status, customer: idOf(s.customer), created: londonStamp(s.created), metadataUserId: s.metadata?.userId ?? null })),
      sample: subs.slice(0, 20).map((s) => ({ id: s.id, status: s.status, created: londonStamp(s.created) })),
    };
  } catch (e) {
    warn(`Platform-account subscription scan failed: ${e.message}`);
    return { error: e.message };
  }
}

// ────────────────────────────────── output ──────────────────────────────────

function printSummary() {
  const rows = report.subscriptions;
  const sum = (f) => rows.filter(f).reduce((t, r) => t + (r.expectedChargePence ?? 0), 0);
  const g = rows.filter((r) => r.classification === "GREEN");
  const a = rows.filter((r) => r.classification === "AMBER");
  const rd = rows.filter((r) => r.classification === "RED");
  report.totals = {
    subscriptionsDue: rows.length,
    grossExpectedPence: sum(() => true),
    green: { count: g.length, valuePence: sum((r) => r.classification === "GREEN") },
    amber: { count: a.length, valuePence: sum((r) => r.classification === "AMBER") },
    red: { count: rd.length, valuePence: sum((r) => r.classification === "RED") },
  };

  const line = "─".repeat(78);
  console.log(`\n${line}`);
  console.log(`STRIPE RENEWAL AUDIT — ${TARGET_DATE} (Europe/London)   [READ-ONLY]`);
  console.log(line);
  console.log(`Key mode              : ${KEY_IS_LIVE ? "LIVE" : "TEST"} (${KEY_TYPE}${KEY_IS_RESTRICTED ? ", restricted" : ""})`);
  console.log(`API version requested : ${STRIPE_API_VERSION}`);
  console.log(`API version observed  : ${report.meta.stripeApiVersionObserved ?? "(not reported)"}`);
  console.log(`Connected account     : ${CONNECTED_ACCOUNT}`);
  console.log(`  charges_enabled     : ${report.account?.chargesEnabled}`);
  console.log(`  card_payments       : ${report.account?.cardPaymentsCapability}`);
  console.log(`  disabled_reason     : ${report.account?.disabledReason ?? "none"}`);
  console.log(`  requirements due    : ${(report.account?.currentlyDue ?? []).length} now, ${(report.account?.pastDue ?? []).length} past due`);
  console.log(`Stripe API calls      : ${apiCalls}`);
  console.log(line);
  console.log(`Subscriptions due     : ${rows.length}`);
  console.log(`Gross expected        : ${money(report.totals.grossExpectedPence)}`);
  console.log(`  GREEN               : ${g.length}  (${money(report.totals.green.valuePence)})`);
  console.log(`  AMBER               : ${a.length}  (${money(report.totals.amber.valuePence)})`);
  console.log(`  RED                 : ${rd.length}  (${money(report.totals.red.valuePence)})`);
  console.log(line);

  const table = (label, set) => {
    if (!set.length) return;
    console.log(`\n${label}`);
    for (const r of set) {
      console.log(
        `  ${r.classification.padEnd(5)} ${r.stripeSubscriptionId}  ${String(r.status).padEnd(10)} ` +
        `${(r.customerEmail ?? "—").padEnd(32)} ${String(money(r.expectedChargePence, r.currency)).padEnd(12)} ` +
        `${r.nextBillingLondon}`,
      );
      console.log(`        customer=${r.stripeCustomerId} pm=${r.paymentMethod.id ?? "NONE"} (${r.paymentMethod.resolvedFrom ?? "unresolved"})` +
        `${r.paymentMethod.cardBrand ? ` ${r.paymentMethod.cardBrand} •••• ${r.paymentMethod.cardLast4} exp ${r.paymentMethod.cardExpMonth}/${r.paymentMethod.cardExpYear}` : ""}`);
      for (const reason of r.reasons) console.log(`        ${reason.level}: ${reason.reason}`);
    }
  };
  table("RED — configuration appears capable of preventing collection:", rd);
  table("AMBER — Stripe should still attempt, but watch these:", a);
  if (process.env.AUDIT_VERBOSE) table("GREEN:", g);

  if (report.reconciliation) {
    const rc = report.reconciliation;
    console.log(`\n${line}\nRECONCILIATION\n${line}`);
    console.log(`app_settings.payments_mode          : ${rc.paymentsMode ?? "(unreadable)"} ${rc.paymentsModeMatchesKey === false ? "  ⚠ DOES NOT MATCH THE AUDIT KEY MODE" : ""}`);
    console.log(`membership rows (this env)          : ${rc.membershipRowsInThisEnv} (${rc.membershipRowsLive} live)`);
    console.log(`DB live rows with no Stripe sub     : ${rc.dbWithoutStripe.length}`);
    console.log(`Stripe live subs with no DB row     : ${rc.stripeWithoutDb.length}`);
    console.log(`Status mismatches                   : ${rc.statusMismatch.length}`);
    console.log(`Billing-date mismatches             : ${rc.dateMismatch.length}`);
    console.log(`Amount mismatches                   : ${rc.amountMismatch.length}`);
    console.log(`Price/item mismatches               : ${rc.priceMismatch.length}`);
    console.log(`Customers with >1 live subscription : ${rc.duplicateSubscriptions.length}`);
    console.log(`Duplicate membership rows           : ${rc.duplicateMemberships.length}`);
    console.log(`Stripe customer shared by >1 user   : ${rc.sharedCustomers.length}`);
    console.log(`Rows whose FREE MONTH is ${String(Number(TARGET_DATE.slice(5, 7))).padStart(2, "0")} (voided) : ${rc.freeMonthVoidingOnTargetMonth.length}`);
    console.log(`Live rows NOT due on ${TARGET_DATE}      : ${rc.liveRowsNotDueOnTargetDate.length}`);
    console.log(`Card saved but membership cancelled : ${rc.abandonedButCardSaved.length}` +
      `${rc.abandonedButCardSaved.length ? "   ⚠ these parents saved a card and were dropped silently" : ""}`);
    for (const r of rc.abandonedButCardSaved) {
      console.log(`    - ${r.email ?? r.userId}  sub=${r.stripeSubscriptionId}  seti=${r.setupIntentId}  pm=${r.savedPaymentMethod}  £${r.monthlyAmount}/mo  cancelled ${r.cancelledAt}`);
    }
    for (const r of rc.dbWithoutStripe) console.log(`    DB→Stripe missing: ${r.email ?? r.userId}  ${r.stripeSubscriptionId}  (${r.note})`);
    for (const r of rc.stripeWithoutDb) console.log(`    Stripe→DB missing: ${r.stripeSubscriptionId}  ${r.status}  ${r.amount}  userId=${r.metadataUserId}`);
    for (const r of rc.duplicateSubscriptions) console.log(`    Duplicate subs for ${r.customer}: ${r.subscriptionIds.join(", ")}`);
    for (const r of rc.statusMismatch) console.log(`    Status mismatch: ${r.email ?? r.userId}  db=${r.dbStatus} stripe=${r.stripeStatus ?? "?"}  (${r.note})`);
    for (const r of rc.amountMismatch) console.log(`    Amount mismatch: ${r.email ?? r.userId}  db=${r.dbAmount} stripe=${r.stripeAmount}`);
    for (const r of rc.dateMismatch) console.log(`    Date mismatch:   ${r.email ?? r.userId}  db=${r.dbPeriodEnd} stripe=${r.stripePeriodEnd}`);
  }

  if (report.webhooks) {
    console.log(`\n${line}\nWEBHOOKS\n${line}`);
    if (!report.webhooks.assessment.length) console.log("  (no payments-webhook endpoint found)");
    for (const a of report.webhooks.assessment) {
      if (!a.endpoint) { console.log(`  ${a.level}: ${a.note}`); continue; }
      console.log(`  ${a.endpoint}  connect=${a.connect}  api=${a.apiVersion ?? "account default"}`);
      console.log(`    ${a.url}`);
      for (const n of a.notes) console.log(`    ${n.level}: ${n.note}`);
      for (const m of a.missing) console.log(`    missing '${m.event}' — ${m.why}`);
      if (!a.notes.length && !a.missing.length) console.log("    OK");
    }
  }

  if (report.warnings.length) {
    console.log(`\n${line}\nWARNINGS\n${line}`);
    for (const w of report.warnings) console.log(`  - ${w}`);
  }
  console.log("");
}

function writeCsv(file) {
  const cols = [
    "classification", "stripeSubscriptionId", "connectedAccountId", "livemode", "status",
    "collectionMethod", "stripeCustomerId", "customerName", "customerEmail", "internalUserId",
    "nextBillingLondon", "nextBillingIso", "expectedChargePence", "currency",
    "trialEnd", "cancelAtPeriodEnd", "cancelAt", "pauseCollectionBehavior",
    "paymentMethodId", "paymentMethodResolvedFrom", "paymentMethodType", "cardBrand",
    "cardExpMonth", "cardExpYear", "pmBelongsToCustomer", "pmInConnectedAccount",
    "applicationFeePercent", "priceIds", "quantities", "reasons",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.join(",")];
  for (const r of report.subscriptions) {
    lines.push([
      r.classification, r.stripeSubscriptionId, r.connectedAccountId, r.livemode, r.status,
      r.collectionMethod, r.stripeCustomerId, r.customerName, r.customerEmail, r.internalUserId,
      r.nextBillingLondon, r.nextBillingIso, r.expectedChargePence, r.currency,
      r.trialEnd, r.cancelAtPeriodEnd, r.cancelAt, r.pauseCollection?.behavior ?? "",
      r.paymentMethod.id, r.paymentMethod.resolvedFrom, r.paymentMethod.type, r.paymentMethod.cardBrand,
      r.paymentMethod.cardExpMonth, r.paymentMethod.cardExpYear, r.paymentMethod.belongsToSubscriptionCustomer,
      r.paymentMethod.existsInConnectedAccount, r.applicationFeePercent,
      r.items.map((i) => i.priceId).join(" "), r.items.map((i) => i.quantity).join(" "),
      r.reasons.map((x) => `${x.level}: ${x.reason}`).join(" | "),
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

async function main() {
  console.error(`Stripe renewal audit — READ ONLY. Target billing day: ${TARGET_DATE} (${LONDON_TZ}).`);
  console.error(`Window: ${new Date(DAY_START * 1000).toISOString()} → ${new Date(DAY_END * 1000).toISOString()}`);

  await auditAccount();
  await auditWebhooks();

  const allSubs = await loadSubscriptions();
  console.error(`  ${allSubs.length} subscription(s) visible in ${CONNECTED_ACCOUNT}`);

  const due = [];
  for (const sub of allSubs) {
    const d = dueOnTargetDate(sub);
    if (d) due.push([sub, d]);
  }
  console.error(`  ${due.length} due on ${TARGET_DATE}; auditing each…`);

  for (const [sub, d] of due) {
    try {
      report.subscriptions.push(await auditSubscription(sub, d));
    } catch (e) {
      warn(`Audit of ${sub.id} failed: ${e.message}`);
      report.subscriptions.push({
        classification: "RED", stripeSubscriptionId: sub.id, status: sub.status,
        reasons: [{ level: "RED", reason: `Auditor could not fully inspect this subscription: ${e.message}` }],
        expectedChargePence: 0, currency: "gbp", items: [],
        paymentMethod: { id: null, resolvedFrom: null }, nextBillingLondon: londonStamp(d.anchorUnix),
      });
    }
  }

  report.subscriptions.sort((x, y) =>
    ({ RED: 0, AMBER: 1, GREEN: 2 })[x.classification] - ({ RED: 0, AMBER: 1, GREEN: 2 })[y.classification]);

  if (DO_RECONCILE) report.reconciliation = await reconcile(report.subscriptions, allSubs);
  if (DO_PLATFORM_SCAN) report.platformScan = await platformScan();

  report.meta.stripeApiVersionObserved = observedApiVersion;
  printSummary();

  if (CSV_OUT && typeof CSV_OUT === "string") {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(CSV_OUT, writeCsv());
    console.error(`CSV written to ${CSV_OUT}`);
  }
  if (JSON_OUT) {
    const text = JSON.stringify(report, null, 2);
    if (typeof JSON_OUT === "string") {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(JSON_OUT, text);
      console.error(`JSON written to ${JSON_OUT}`);
    } else {
      console.log(text);
    }
  }

  // Exit code carries the verdict so CI/operators can gate on it.
  process.exit(report.totals.red.count > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`AUDIT FAILED: ${e.message}`);
  process.exit(3);
});
