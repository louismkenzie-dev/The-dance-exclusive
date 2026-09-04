# Production payment audit — monthly membership renewals, 5 September 2026

**Scope:** can our application and Stripe configuration correctly cause every valid
monthly subscription due on 5 September 2026 to be *attempted*, and are the
resulting successes and failures processed correctly?

**Status of this document:** all static/code analysis is complete and evidenced
against the repository. **No live Stripe data was read**, because no Stripe
credentials are present in this environment and outbound access to
`api.stripe.com` is blocked by the sandbox's egress proxy. The live half of the
audit is packaged as a read-only script — see
[§9 Running the live audit](#9-running-the-live-audit).

---

## 1. Architecture — how tomorrow's payments actually work

```
Parent basket (monthly plan)
  └─ POST create-payment-intent                       supabase/functions/create-payment-intent/index.ts
       ├─ env := app_settings.payments_mode           _shared/paymentsMode.ts:11   (server-authoritative)
       ├─ stripe := platform secret key               _shared/stripe.ts:8
       ├─ every call carries Stripe-Account: acct_…   _shared/stripe.ts:54   ← DIRECT CHARGES
       ├─ Customer  find-or-create on connected acct  create-payment-intent/index.ts:655-682
       │    └─ id cached in profiles.stripe_customer_id
       ├─ Price     one ad-hoc recurring price/item   create-payment-intent/index.ts:686-700
       └─ Subscription
            trial_end               = 5th of next month, 07:00 UTC   _shared/billing.ts:38
            proration_behavior      = none
            payment_behavior        = default_incomplete
            save_default_payment_method = on_subscription
            payment_method_types    = ["card"]
            application_fee_percent = 1        (platform fee on the direct charge)
            collection_method       = (unset → Stripe default charge_automatically)
            metadata                = the whole cart, keyed item_0…item_n
                                                     create-payment-intent/index.ts:770-799

  ── Signup OUTSIDE August ──                ── Signup DURING August (the 5 Sep cohort) ──
  First month rides the first invoice as     Nothing is charged today. Stripe returns a
  an add_invoice_item; Stripe returns        pending_setup_intent; the parent confirms it
  latest_invoice.payment_intent; the         with stripe.confirmSetup().
  parent confirms it inline.                 Checkout.tsx:230 / CheckoutReturn.tsx:186
                                             then finalize-membership-setup COPIES the saved
                                             card onto subscription.default_payment_method
                                             finalize-membership-setup/index.ts:100-109

5 Sept 07:00 UTC   trial ends → Stripe raises the first recurring invoice
5 Sept ~08:00 UTC  Stripe auto-finalises it and charges the default payment method
                   → direct charge on acct_1TqvwgCcuURED2Xm, 1% application fee to the platform
                   → webhook payment_intent.succeeded → payments-webhook?env=live
                        └─ fulfillInvoicePaymentIntent()          _shared/fulfilment.ts:244
                             billing_reason=subscription_create → activateMembershipCheckout()
                             otherwise (renewal)                 → roll current_period_end,
                                                                   clear past_due
```

**Answers to the Phase 1 questions**

| Question | Answer | Evidence |
|---|---|---|
| Genuine Stripe Billing subscriptions? | **Yes.** `stripe.subscriptions.create` with a recurring price. | `create-payment-intent/index.ts:770` |
| Does Stripe collect, or do we? | **Stripe.** No cron creates PaymentIntents for renewals. | no renewal-charge code anywhere; `memberships-maintenance` only reads/syncs |
| How are Checkout Sessions created? | `create-checkout` exists but is **legacy and not used for memberships** — `mode: "payment"`, embedded UI, one-off baskets only. Monthly flows never touch it. | `create-checkout/index.ts:120`; webhook comment `payments-webhook/index.ts:90` |
| Which Checkout mode? | `mode: "payment"` (legacy path only). Memberships use **Payment Element + Subscriptions API**, not hosted Checkout `mode: "subscription"`. | as above |
| Free trials / deferred first payment? | **Yes** — a Stripe trial is used purely as a billing anchor. August signups defer their whole first payment to 5 Sept. | `_shared/billing.ts:38,58` |
| How is the 5 Sept date set? | `trial_end` = 5th of the month after signup at **07:00 UTC** — chosen because that is the morning of the 5th in London in both GMT and BST. | `_shared/billing.ts:33-43` |
| Customers | Created on the **connected account**, cached in `profiles.stripe_customer_id`, re-validated (and recreated if deleted) each checkout. | `create-payment-intent/index.ts:655-682` |
| PaymentMethods | Paid signups: saved by `save_default_payment_method: on_subscription` when the first invoice is paid. August signups: saved by a SetupIntent, then **explicitly attached by our code**. | `create-payment-intent/index.ts:778`; `finalize-membership-setup/index.ts:100-109` |
| Connected account | From `STRIPE_LIVE_CONNECTED_ACCOUNT_ID`, sent as the `Stripe-Account` header on **every** call. Live id also baked into the frontend: `acct_1TqvwgCcuURED2Xm`. | `_shared/stripe.ts:47-56`; `src/lib/stripe.ts:27` |
| Connect architecture | **Direct charges** with a 1% `application_fee`. | `docs/STRIPE_CONNECT_SETUP.md:10-18` |
| Platform fee | `application_fee_percent` on subscriptions; `application_fee_amount` on one-off PaymentIntents. Default 1%, overridable by `PLATFORM_FEE_PERCENT`. | `_shared/stripe.ts:60-77`; `_shared/platformFee.ts` |
| Webhooks | One endpoint, `payments-webhook`, env chosen by a **query parameter**. | `payments-webhook/index.ts:27-31` |
| Success → database | `payment_intent.succeeded` → `fulfillInvoicePaymentIntent` rolls `current_period_end` and clears `past_due`. | `_shared/fulfilment.ts:281-292` |
| Failure → database | **No webhook handler.** Only the daily 06:10 UTC cron sets `past_due` and emails the parent. | `memberships-maintenance/index.ts:201-227` |
| 3-D Secure on renewal | **No handler.** Same cron path, one day late. | as above |
| Duplicate webhook delivery | No event-id ledger; idempotency comes from "does a booking already exist" guards. | `_shared/fulfilment.ts:124-138, 159-172` |
| Scheduled jobs in payment processing | `pg_cron` → `memberships-maintenance`, daily 06:10 UTC. **Not required for collection**, but it can pause/cancel subscriptions. | `supabase/migrations/20260723121000_schedule_memberships_maintenance.sql` |

---

## 2. Stripe Billing implementation — verification

**Correct, and deliberately so:**

* Real subscriptions, not simulated recurring charges.
* `collection_method` is never set, so Stripe's default `charge_automatically`
  applies. Nothing in the codebase writes `send_invoice` for memberships
  (`party-manage` uses `send_invoice`, but only for party deposits/balances).
* The API version is pinned to `2025-02-24.acacia` with a comment explaining
  exactly why (`_shared/stripe.ts:15-21`): stripe-node v18 defaults to "Basil",
  which removed `subscription.current_period_end`, `invoice.payment_intent` and
  `invoice.subscription` — all three of which this code reads. Verified against
  the `stripe@17.7.0` type definitions, whose `LatestApiVersion` is exactly
  `'2025-02-24.acacia'`, that every field the code and the auditor use exists in
  that version.
* The webhook already defends against the version mismatch that *does* remain:
  webhook payloads are rendered at the **endpoint's** API version, so if the
  endpoint is on Basil, `pi.invoice` is absent — the handler re-retrieves the
  PaymentIntent under the pinned version to recover the invoice link
  (`payments-webhook/index.ts:118-132`). That is a good catch and it works.
* SCA/off-session preparation is as good as this shape allows: the August
  cohort authenticated a SetupIntent at signup (Stripe issues it with
  `usage: off_session`), which is the correct preparation for an off-session
  renewal.

**Not the Stripe-recommended shape, though it works:** memberships use the
Payment Element + Subscriptions API rather than hosted Checkout
`mode: "subscription"`. That is a legitimate integration; it just moves more
responsibility into our code — including the one place it goes wrong (§3.1).

**Housekeeping:** every checkout creates a brand-new ad-hoc `Price` (and one or
two `Product`s). Functionally fine; it will make the Products catalogue
unusable over time.

---

## 3. Findings

### 3.1 🔴 CRITICAL — a saved card that never reaches the subscription gets the subscription **cancelled**

This is the single most important finding, and it targets exactly the cohort
due tomorrow: the August £0-today signups.

Stripe does **not** promote a succeeded `pending_setup_intent` to the
subscription's default payment method. Stripe's own API description of the
setting the code relies on is explicit:

> `save_default_payment_method` — *Configure whether Stripe updates
> `subscription.default_payment_method` **when payment succeeds**.*
> (`stripe@17.7.0/types/Subscriptions.d.ts:418`)

An August signup has no payment, so nothing promotes the card. Our code does it
instead — in `finalize-membership-setup`, which is only ever invoked **from the
browser**:

* `src/pages/portal/Checkout.tsx:248` — inline, right after `confirmSetup`
* `src/pages/portal/CheckoutReturn.tsx:186` — on the return page

Both calls are wrapped in `catch {}` and both require a valid Supabase JWT
(`finalize-membership-setup/index.ts:41-44`). If the parent closed the tab
during the 3-D Secure redirect, or their session had expired by the time they
came back, neither call lands.

The daily job is documented as the fallback (`CheckoutReturn.tsx:194`
*"maintenance job completes the activation"*), but read what it actually does:

```js
// supabase/functions/memberships-maintenance/index.ts:235-254
if (sub.status === "trialing") {
  if (sub.default_payment_method && members.some(x => x.status === "incomplete")) {
    await activateMembershipSetup(supabase, sub);          // needs the PM already set
  } else if (!sub.default_payment_method && sub.created * 1000 < Date.now() - 24*3600_000) {
    await stripe.subscriptions.cancel(subId, {}, connectOpts);   // ← cancels it
    …
  }
}
```

The recovery branch requires `default_payment_method` to already be set — i.e.
it can only rescue a run where `finalize-membership-setup` *did* set the card
and then failed later. In the case it is documented as covering — finalize never
ran at all — the **other** branch fires and cancels the subscription 24 hours
after signup. The orphan sweep (`:292-312`) does the same for re-checkouts.

No email is sent (`:185` skips the notice for `incomplete` rows), so the parent
believes they are enrolled while the subscription is gone.

**Impact:** any such parent will not be charged on 5 September and has no
booking. **Whether this happened, and to how many, is a live-data question** —
`--reconcile` reports it directly as *"Card saved but membership cancelled"*, by
checking whether the stored `stripe_setup_intent_id` actually succeeded.

### 3.2 🔴 No webhook handling of failed or authentication-required renewals

`payments-webhook` handles exactly three event types
(`payments-webhook/index.ts:34-46`): `checkout.session.completed`,
`payment_intent.succeeded`, `invoice.paid` — and `invoice.paid` returns
immediately unless the invoice carries `party_inquiry_id`
(`:60-62`), so it does nothing for memberships.

Both operator documents list the registered event set as
`checkout.session.completed`, `payment_intent.succeeded` only
(`docs/STRIPE_CONNECT_SETUP.md:54`, `docs/VENUE_UPDATES_2026.md:125`), with the
note *"Failure/cancel paths need no handler"* — which was true before
memberships existed and is not true now.

Consequences on 5 September:

* a decline is not recorded until the **06:10 UTC cron on 6 September**;
* `invoice.payment_action_required` (3-D Secure on an off-session renewal) is
  likewise invisible to us for up to a day;
* the parent's "payment issue" badge and the *Pay now* link in `MyBookings`
  depend on `memberships.status = 'past_due'`, which only that cron sets.

Money is still collected correctly — this is a **reporting and recovery delay**,
not a collection failure. It is the difference between a parent hearing about a
declined card in minutes versus the next morning.

### 3.3 🔴 A misconfigured webhook URL fails silently and completely

The environment is taken from a query parameter with a sandbox default:

```js
// payments-webhook/index.ts:27-28
const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;
```

If the live endpoint URL is missing `?env=live`, every live event is verified
against the **sandbox** signing secret, throws, and returns HTTP 400
(`:52-55`). Stripe would retry and eventually disable the endpoint; nothing in
the database would ever update. This must be verified before tomorrow — the
auditor checks it (`--json` → `webhooks.assessment`).

Equally: because these are **direct charges**, the events are raised on the
*connected* account. A platform-only endpoint receives nothing. The endpoint
must have *"Listen to events on connected accounts"* enabled
(`docs/STRIPE_CONNECT_SETUP.md:49`).

### 3.4 🟠 `invoice.created` must stay **unsubscribed**

Stripe holds a draft invoice — up to 72 hours — waiting for a 2xx from any
endpoint subscribed to `invoice.created` before auto-finalising it. This
handler has no `invoice.created` case and returns 400 on any signature problem,
so subscribing to it (or to `*`) would stall the finalisation of every renewal
invoice. It is currently *not* subscribed, which is correct. The auditor flags
it as RED if it ever appears.

### 3.5 🟠 No idempotency ledger for webhook events

There is no `stripe_events` table and no event-id dedupe. Idempotency relies on
"does a matching booking already exist" checks
(`_shared/fulfilment.ts:124-138, 159-172`) and on
`activateMembershipSetup` only acting while `incomplete` rows remain
(`:349-359`). Those are sound for the common case, but two concurrent
deliveries of the same event can both pass the read before either writes.
Renewals are the low-risk path here (a renewal only updates timestamps), so
this is not a 5 September blocker.

Out-of-order delivery is also unhandled: `current_period_end` is written
unconditionally (`_shared/fulfilment.ts:282-286`), so a late-arriving older
event can move it backwards. Cosmetic — the cron re-syncs it daily.

### 3.6 🟠 Parents cannot update a card until *after* a payment fails

`manage-membership` supports `cancel`, `switch_class` and `payment_link`
(`manage-membership/index.ts:68`). `payment_link` returns
`invoice.hosted_invoice_url`, but only when an invoice is already `open`
(`:131-146`) — i.e. only after a failure. There is no Stripe Customer Portal
session and no standalone "update card" flow, so a parent who knows their card
has been replaced cannot fix it in advance. `switch_class` even tells them to
*"update your card details first"* (`:251`) with no way to do so.

### 3.7 🟠 Smart Retries / revenue recovery is dashboard configuration, unverified

Nothing in the code configures retries; Stripe's dunning settings decide what
happens after a decline. Because these are **direct charges, the settings that
matter live on the connected account** (`acct_1TqvwgCcuURED2Xm`), not the
platform. Worth confirming before tomorrow: Smart Retries on, retry schedule,
customer emails for failed payments and for authentication required.

### 3.8 🟢 The renewal does **not** depend on our scheduler — and the cron will not interfere

Confirmed by walking the cron for the relevant dates. `memberships-maintenance`
runs at 06:10 UTC; the trial ends at 07:00 UTC on the 5th.

* **5 Sept 06:10** — subscriptions are still `trialing`, have a
  `default_payment_method`, and have no `incomplete` rows, so both branches at
  `:235-254` are no-ops.
* The free-month pause at `:255` requires `sub.status === "active"` **and**
  `londonYMD().m === free_month`. For September that needs `free_month = 9`,
  which `freeMonthFor()` only produces for **October** signups
  (`_shared/billing.ts:51-55`) — and the memberships system launched in July
  2026, with every pre-existing row backfilled to `8`
  (`20260803120000_billing_free_month.sql:15`). So no live row should have
  `free_month = 9`. **The auditor verifies this rather than assuming it**
  (`freeMonthVoidingOnTargetMonth`).

If the cron does not run tomorrow, renewals still happen. Only the recording of
failures is delayed.

### 3.9 🟢 Other things checked and found correct

* One-off and termly payments are plain PaymentIntents with `card` only, priced
  entirely server-side (`create-payment-intent/index.ts:875-905`).
* `payments_mode` is server-authoritative and fails **closed into sandbox**
  (`_shared/paymentsMode.ts:22-28`) — the safe direction.
* `manage-membership` and `finalize-membership-setup` always use the
  membership row's own `stripe_env`, never a client value
  (`manage-membership/index.ts:107-109`).
* Cancellation keeps the notice month: `cancel_at = current_period_end + 1
  month`, so a parent who cancelled in August **is still charged on 5
  September** (`manage-membership/index.ts:166-185`). Correct, and the auditor
  treats a `cancel_at` on the billing day as RED.
* No secret key appears anywhere in the repository. The two publishable keys
  and the two `acct_` ids in `src/lib/stripe.ts` are public by design. The
  Supabase **anon** key is hard-coded in
  `20260723121000_schedule_memberships_maintenance.sql:16`; it is publishable
  and RLS-protected, but it should be rotated to a Vault reference at some
  point.

---

## 4. Phases that require live credentials

| Phase | Status |
|---|---|
| 4 — read-only live auditor | **Built and unit-tested.** Not executed: no credentials, and `api.stripe.com` is blocked from this environment. |
| 5 — GREEN/AMBER/RED classification | Rules implemented and tested; needs a live run for real counts. |
| 6 — two-way reconciliation | Implemented (`--reconcile`); needs `SUPABASE_SERVICE_ROLE_KEY`. |
| 7 — webhook audit | Static analysis complete (§3.2–3.4). Live endpoint check implemented; needs *Webhook endpoints: read*. |
| 8 — failure recovery | Static analysis complete (§3.2, §3.6, §3.7). |
| 9 — test-clock rehearsal | Harness built (`scripts/stripe-renewal-rehearsal.mjs`, test-mode only). **Not executed** — no test credentials, no network. |

---

## 5. What happens tomorrow in each outcome

| Outcome | Stripe | Our application |
|---|---|---|
| Succeeds | invoice paid, direct charge on the connected account, 1% application fee | `payment_intent.succeeded` → `current_period_end` rolls, any `past_due` cleared. ✅ |
| Generic decline | `invoice.payment_failed`, subscription → `past_due`, dunning begins | **Nothing until 06:10 UTC the next day**, then `past_due` + "payment failed" email with the hosted invoice link. ⚠️ |
| Insufficient funds | as above | as above ⚠️ |
| Expired / replaced card | as above | as above; parent has no way to pre-empt it (§3.6) ⚠️ |
| Requires 3-D Secure | `invoice.payment_action_required`, invoice stays open | No handler. Depends entirely on Stripe's own customer emails being enabled on the connected account. ⚠️ |
| No payment method | invoice cannot be paid | Same one-day-late path. The auditor catches these **before** they happen — this is the case to fix today. 🔴 |
| Transient Stripe/API error | Stripe retries internally; webhook retries with fresh signatures (so the 300-second timestamp check in `_shared/stripe.ts:97` is safe) | Fine, plus `get-payment-intent-status` acts as a polling fallback for checkout. ✅ |

Legitimate bank declines are **not** application failures and are not counted as
such anywhere in this document or in the auditor's RED class.

---

## 6. Recommended actions

**Before 07:00 UTC on 5 September (verification only — no changes to live subscriptions):**

1. Run the auditor (§9). Treat any RED as a call, not a code change.
2. Confirm in the Stripe dashboard that the live `payments-webhook` endpoint
   (a) is a **Connect** endpoint, (b) ends in `?env=live`, (c) is enabled,
   (d) is **not** subscribed to `invoice.created`.
3. Confirm the connected account's dunning settings: Smart Retries, failed-payment
   emails, authentication-required emails.
4. For anyone the auditor lists under *"Card saved but membership cancelled"*
   (§3.1): decide with the studio how to contact them. **Do not** recreate
   subscriptions without agreeing it first.

**After the billing run:**

5. Subscribe the live endpoint to `invoice.payment_failed`,
   `invoice.payment_action_required`, `customer.subscription.deleted`,
   `customer.subscription.updated`, and add handlers.
6. Fix §3.1 properly: have `create-payment-intent` set the Customer's
   `invoice_settings.default_payment_method` as well, and make the maintenance
   job promote a succeeded SetupIntent's payment method instead of cancelling.
7. Add a `stripe_events` table keyed on the Stripe event id.
8. Add a Customer Portal (or SetupIntent) flow so parents can update a card
   before it fails.

---

## 7. Files added by this audit

| File | Purpose |
|---|---|
| `scripts/stripe-billing-audit.mjs` | Read-only live auditor (Phases 4–7). GET-only transport; refuses mutation flags; never prints a key. |
| `scripts/lib/renewalAuditCore.mjs` | Pure date/precedence logic shared with the test suite. |
| `src/lib/renewalAuditCore.test.ts` | 27 tests covering London day boundaries (including both clock changes), the 07:00 UTC anchor, Stripe's payment-method precedence and card expiry. |
| `scripts/stripe-renewal-rehearsal.mjs` | Test-clock rehearsal harness (Phase 9). **Refuses any live key.** |

---

## 8. Credentials the live audit needs

Nothing here should be added to the repository or to any client bundle.

| Variable | Value | Needed for |
|---|---|---|
| `STRIPE_API_KEY` | A **restricted** key (`rk_live_…`) on the **platform** account | all live checks |
| `STRIPE_CONNECTED_ACCOUNT_ID` | `acct_1TqvwgCcuURED2Xm` | entering the account context that owns the subscriptions |
| `SUPABASE_URL` | `https://suwaetnsszlpaaykhpif.supabase.co` | `--reconcile` only |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key | `--reconcile` only |

**Restricted-key permissions — all READ, nothing else:**

* Core — Customers, PaymentMethods, Products, Prices, PaymentIntents/Charges, Balance
* Billing — Subscriptions, Invoices, Coupons
* Connect — Connected accounts *(for the capability check)*
* Webhooks — Webhook endpoints *(for the webhook audit)*

The key must be created on the **platform** account, because every request is a
direct charge routed with the `Stripe-Account` header.

---

## 9. Running the live audit

```bash
# Read-only. Never writes, never charges, never cancels.
STRIPE_API_KEY=rk_live_… \
STRIPE_CONNECTED_ACCOUNT_ID=acct_1TqvwgCcuURED2Xm \
SUPABASE_URL=https://suwaetnsszlpaaykhpif.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=… \
node scripts/stripe-billing-audit.mjs \
  --date=2026-09-05 --reconcile --all-statuses --platform-scan \
  --csv=/tmp/renewals-2026-09-05.csv \
  --json=/tmp/renewals-2026-09-05.json
```

Exit code `0` = no RED, `1` = at least one RED, `2` = bad invocation,
`3` = the audit itself could not complete.

Test-mode rehearsal (never point it at live — it refuses):

```bash
STRIPE_API_KEY=sk_test_… STRIPE_CONNECTED_ACCOUNT_ID=acct_1TnJ2NE0aLUyRazc \
node scripts/stripe-renewal-rehearsal.mjs --scenario=all
```
