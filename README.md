# The Dance Exclusive

Booking and management platform for The Dance Exclusive — an Essex-based dance school
offering classes, holiday camps, workshops, and birthday parties.

Three surfaces:
- **Parent portal** — browse classes by location, book and pay, manage children and bookings.
- **Staff portal** — class registers, schedules, documents, profile.
- **Admin** — classes, camps, workshops, parties, merchandise, venues, staff, customers,
  bookings, coupons, registers and settings.

## Tech stack

- Vite + React + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Postgres, Auth, Storage, Edge Functions)
- Stripe (PaymentIntents) for checkout

## Local development

Requires Node.js (use [nvm](https://github.com/nvm-sh/nvm)).

```sh
npm install
npm run dev        # http://localhost:8080
npm run build      # production build
npm run test       # vitest
```

## Configuration

Frontend env (`.env`):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`
- `VITE_PAYMENTS_CLIENT_TOKEN` — Stripe publishable key (`pk_test_…` / `pk_live_…`)

Edge-function secrets (set in the Supabase dashboard or via `supabase secrets set`):

- `STRIPE_SANDBOX_API_KEY`, `STRIPE_LIVE_API_KEY` — Stripe secret keys (`sk_test_…` / `sk_live_…`)
- `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `PAYMENTS_LIVE_WEBHOOK_SECRET` — Stripe webhook signing secrets
- `RESEND_API_KEY`, `EMAIL_FROM` — transactional email

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected into edge
functions automatically.

## Database

Schema is managed as migrations in `supabase/migrations/`. Apply with:

```sh
supabase link --project-ref <your-project-ref>
supabase db push
supabase functions deploy
```
