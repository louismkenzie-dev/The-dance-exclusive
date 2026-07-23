# Stripe Connect — Nullshift 1% Platform Fee

Agreed commercial model: when a parent pays for a booking —
**Stripe takes its processing fees → Nullshift takes a 1% application fee
(into the Nullshift platform Stripe account) → the remainder settles in
The Dance Exclusive's connected Stripe account.**

## How it's implemented

All charges are **direct charges on The Dance Exclusive's connected account**,
created with the **Nullshift platform API key** plus the `Stripe-Account`
header. Every charge — class bookings and merch — carries
`application_fee_amount = 1%` of the charged total (after coupons), rounded
to the nearest penny, minimum 1p.

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

## Sandbox ↔ live switch (server-authoritative)

Which environment the platform charges in is decided by ONE switch — the
`payments_mode` row in `app_settings` (`sandbox` | `live`). The payment edge
functions read it on every request (a request can no longer choose its own
environment), and the frontend reads the same row to pick the matching
publishable-key + connected-account pair in `src/lib/stripe.ts` (the live
pair is baked there; the sandbox pair comes from the `VITE_*` build env with
baked fallbacks). `manage-membership` is the exception: it always uses the
membership row's own `stripe_env`.

Go live (in this order):
1. Make sure the live pair in `src/lib/stripe.ts` (`LIVE_PUBLISHABLE_KEY`,
   `LIVE_CONNECTED_ACCOUNT`) is filled and the frontend deployed.
2. `update app_settings set value = 'live', updated_at = now() where key = 'payments_mode';`

Roll back to test mode by setting it back to `sandbox`. No frontend rebuild
needed for the flip itself — open pages pick it up on the next page load.

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
