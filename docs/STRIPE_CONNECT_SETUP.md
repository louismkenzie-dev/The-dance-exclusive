# Stripe Connect — Nullshift 1% Platform Fee

Agreed commercial model: when a parent pays for a booking —
**Stripe takes its processing fees → Nullshift takes a 1% application fee
(into the Nullshift platform Stripe account) → the remainder settles in
The Dance Exclusive's connected Stripe account.**

## How it's implemented

All charges are **direct charges on The Dance Exclusive's connected account**,
created with the **Nullshift platform API key** plus the `Stripe-Account`
header. Class-booking charges carry `application_fee_amount = 1%` of the
charged total (after coupons), rounded to the nearest penny, minimum 1p.
Merch charges route to the connected account **without** an application fee —
the agreement covers booking revenue only.

With direct charges, Stripe's own processing fees are billed to the connected
account (The Dance Exclusive), matching the agreed order: gross − Stripe fees
− 1% Nullshift fee = The Dance Exclusive's net.

**Fallback:** if no connected-account id is configured for an environment,
every function behaves exactly as before Connect (charge on the key's own
account, no fee). Nothing breaks while configuration is incomplete.

## Configuration (operator steps — no secrets in the repo)

Supabase edge-function secrets (`supabase secrets set` or dashboard):

| Secret | Value |
|---|---|
| `STRIPE_LIVE_API_KEY` | **Nullshift platform** live secret key (`sk_live_…`) |
| `STRIPE_SANDBOX_API_KEY` | **Nullshift platform** test secret key (`sk_test_…`) |
| `STRIPE_LIVE_CONNECTED_ACCOUNT_ID` | The Dance Exclusive live connected account (`acct_…`) |
| `STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID` | The Dance Exclusive **test-mode** connected account (`acct_…`) |
| `PLATFORM_FEE_PERCENT` | optional — defaults to `1` |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | signing secrets of the endpoints below |

Frontend build env (Vercel project settings):

| Variable | Value |
|---|---|
| `VITE_PAYMENTS_CLIENT_TOKEN` | **Nullshift platform** publishable key |
| `VITE_STRIPE_CONNECTED_ACCOUNT` | same `acct_…` id as the live connected account |

## Webhooks (must be re-created)

Direct-charge events fire **on the connected account**, so the existing
endpoints registered on the old standalone account will go silent. In the
**Nullshift platform** Stripe dashboard → Developers → Webhooks, create
endpoints with **"Listen to events on connected accounts"** enabled:

- Live: `https://<project-ref>.supabase.co/functions/v1/payments-webhook?env=live`
- Test: `…/payments-webhook?env=sandbox`

Events: `checkout.session.completed`, `payment_intent.succeeded`.
Put each endpoint's signing secret in the matching
`PAYMENTS_*_WEBHOOK_SECRET`. The handler is unchanged — signature scheme and
payload shape are identical for Connect endpoints.

## Deploy & verify

1. `supabase functions deploy` (create-payment-intent, create-checkout,
   create-merch-checkout, get-payment-intent-status, get-session-status —
   payments-webhook unchanged but harmless to redeploy).
2. Redeploy the frontend so the new `VITE_*` vars are baked in.
3. **Test mode:** complete a booking with `4242 4242 4242 4242`, then in the
   platform dashboard check the payment shows on the connected account with
   an application fee, and the fee appears under the platform's **Collected
   fees**. Verify a failed card (`4000 0000 0000 0002`), a duplicate webhook
   replay, and a refund (refunding in the dashboard does **not** auto-return
   the application fee — tick "refund application fee" if that's the policy).
4. **Live:** one £0.30-minimum real booking end-to-end before launch.

## Refunds & disputes (policy note)

On direct charges, refunds are issued from the connected account's balance.
The 1% application fee is only returned to The Dance Exclusive if the refund
explicitly includes it — agree the policy (fee kept vs returned on refunds)
and apply it consistently when refunding in the dashboard.
