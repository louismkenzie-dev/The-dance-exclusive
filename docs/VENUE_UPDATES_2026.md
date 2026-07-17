# Venue Updates — September 2026 Expansion

Implementation of the confirmed WhatsApp requirements (8–16 July 2026) for
The Dance Exclusive booking platform. Target launch: **15 August 2026**.

---

## 1. Repository findings

- **Stack:** Vite + React + TypeScript, Tailwind + shadcn/ui, Supabase
  (Postgres/RLS/Auth/Storage/Edge Functions), Stripe PaymentIntents,
  Resend transactional email, Vitest.
- **Venues** already exist (`venues` table + admin page + Mapbox map) but had
  no lifecycle status, public-visibility, featured or slug fields.
- **Classes** already support age ranges, ability level, gender, pricing plans
  and generated `class_sessions`, but had no school-year bands, audience
  labels, invite-only flag, lifecycle status, or an independent
  visibility/booking split (only `is_active`).
- **Stripe** integration is environment-split (`STRIPE_SANDBOX_API_KEY` /
  `STRIPE_LIVE_API_KEY`, per-env webhook secrets) with signature verification
  and **idempotent booking creation** already implemented in
  `supabase/functions/payments-webhook` (duplicate active booking guard per
  parent/student/class). It is a *direct* Stripe account model (no Connect) —
  see §6.
- **Booking confirmation emails** already exist
  (`send-email` + `booking-confirmation` template via Resend) — in scope,
  needs live testing only.
- The public class browser already includes a **free** postcodes.io distance
  sort. This is unrelated to the paid postcode-finder add-on (kept behind a
  disabled flag, §8).

## 2. Files changed

| Area | File | Change |
|---|---|---|
| DB | `supabase/migrations/20260717090000_venue_updates_sept_expansion.sql` | New venue/class columns, checks, slug backfill |
| Seed | `supabase/seed/september_2026_timetable.sql` | Idempotent September venue + timetable import |
| Types | `src/integrations/supabase/types.ts` | New columns added to generated types |
| Logic | `src/lib/venuePresentation.ts` | Slug, public-listing + featured ordering rules |
| Logic | `src/lib/classAudience.ts` | Audience labels, time/age validation, visibility & booking gates |
| Logic | `src/lib/featureFlags.ts` | `ENABLE_POSTCODE_VENUE_FINDER` (default **off**) |
| UI | `src/components/FeaturedVenueCarousel.tsx` | Accessible featured-venue carousel (embla) |
| UI | `src/pages/Index.tsx` | Carousel section on the homepage |
| UI | `src/pages/portal/ClassBrowser.tsx` | Public gating (confirmed+visible only), audience labels, invite-only messaging, booking gates |
| Admin | `src/pages/admin/Venues.tsx` | Status / visibility / featured / slug / short description controls + list badges |
| Admin | `src/pages/admin/Classes.tsx` | Audience & access step (school years, audience label, invite-only, status, visibility, booking) + list badges |
| Tests | `src/lib/*.test.ts`, `src/components/FeaturedVenueCarousel.test.tsx`, `src/test/setup.ts` | 28 new tests |
| Config | `.env.example` | Feature-flag documentation |

## 3. Database migration

```sh
supabase link --project-ref <project-ref>
supabase db push          # applies 20260717090000_venue_updates_sept_expansion.sql
```

Adds (all additive, no data loss):

- `venues`: `status` (confirmed/provisional/inactive), `publicly_visible`,
  `is_featured`, `featured_order`, `slug` (unique, backfilled),
  `short_description`, `hero_image`; `address_line1`/`postcode` become
  nullable (unconfirmed addresses are never fabricated).
- `classes`: `school_year_min/max`, `audience_label`, `invite_only`,
  `status` (confirmed/provisional/draft/inactive), `publicly_visible`,
  `booking_enabled`, `sort_order`; CHECK constraints (`NOT VALID`, so legacy
  rows are untouched): end after start, coherent age and school-year ranges.

**Rollback:** drop the added columns/constraints (all additive) or restore the
pre-migration backup. No existing column is altered other than the two
`DROP NOT NULL`s, which can be re-tightened once every venue has an address.

## 4. Timetable import (idempotent)

```sh
psql "$DATABASE_URL" -f supabase/seed/september_2026_timetable.sql
# or: supabase db execute --file supabase/seed/september_2026_timetable.sql
```

Safe to re-run: venues match on `slug`, classes on
(venue, name, weekday, start time). Emits a NOTICE with counts.

**Imported: 12 venues, 41 classes** (Mon Clacton ×3, Mon Kelvedon ×5,
Tue Thaxted ×2, Tue Braintree S&H ×4, Tue Wickford ×4, Tue Chatham ×4,
Tue Romford ×3, Tue+Wed White Court ×2, Wed Kelvedon ×4 (incl. hidden NEXUS
draft), Thu White Notley ×5, Thu Harrow ×3, Fri Beaulieu ×1, Mon Coval Lane ×2
hidden provisional).

Every imported class has **booking disabled** (prices/capacities are
unconfirmed — Q19). Admins enable booking per class after setting pricing.
No sessions/occurrences are generated: term dates are unconfirmed (Q14) —
use the admin class wizard once term dates are agreed.

### Records deliberately skipped

| Record | Reason |
|---|---|
| Coval Lane Mini Street (Mon 17:45–?) | No end time (Q10) |
| Coval Lane Mixed Street (Mon 18:45–18:45) | Zero duration (Q11) |

### Records imported but held back

| Record | Handling |
|---|---|
| NEXUS O17 Crew Training (Wed 19:45–20:00) | Hidden draft — 15-minute duration unconfirmed (Q3), meaning of "O17" unconfirmed (Q4) |
| Coval Lane / Chelmsford Theatre venue + 2 classes | Hidden provisional — one-or-two-venues question open (Q9) |
| SURGE Crew vs Mini Street (Mon Kelvedon, 17:00–17:45 overlap) | Both preserved as supplied; room/instructor capacity needs confirmation (Q7) |
| Harrow Arts Centre | Imported as confirmed per the later full-timetable message — needs explicit owner sign-off (Q8) |
| White Court School (Tue + Wed) | One venue record pending address confirmation (Q2) |

## 5. Featured venue carousel

- Admin → Venues → *Publishing & Featuring*: toggle featured, set order,
  short description, status and public visibility.
- Homepage renders up to 3 cards on desktop / 1 on mobile, keyboard-navigable
  labelled controls, no auto-rotation, `/placeholder.svg` fallback when no
  image is mapped, hides itself entirely when nothing is featured.
- **No venues are pre-featured** — which three go first is the client's call
  (Q12). Ordering is deterministic: `featured_order` ascending, nulls last,
  then name.

## 6. Stripe configuration status

- The webhook (`payments-webhook`) verifies signatures per environment and is
  idempotent on duplicate delivery (existing-booking guard). Handled events:
  `checkout.session.completed`, `payment_intent.succeeded` — the exact set
  the repo's payment flow needs. Failure/cancel paths need no handler:
  bookings are only created on success.
- The architecture is a **direct Stripe account** (secret key per env), not
  Stripe Connect. The "new standalone Stripe account" therefore means:
  set the new account's keys as the live secrets. No code change required.
- **Operator actions (not in code, by design — no secrets in the repo):**
  1. In the *new* Stripe account: create live + test API keys.
  2. `supabase secrets set STRIPE_LIVE_API_KEY=sk_live_… STRIPE_SANDBOX_API_KEY=sk_test_…`
  3. Create webhook endpoints in Stripe →
     `https://<project-ref>.supabase.co/functions/v1/payments-webhook?env=live`
     (and `?env=sandbox` on the test-mode endpoint) subscribing to the two
     events above; set `PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET`.
  4. Set `VITE_PAYMENTS_CLIENT_TOKEN` to the **new** account's publishable key
     in the frontend build environment.
  5. Verify no old-account keys remain in Supabase secrets or the frontend env.
- Launch checks (test mode): successful booking, failed/cancelled payment,
  duplicate webhook replay (Stripe CLI `stripe events resend`), refund →
  manual booking-state review (no `charge.refunded` handler exists — refunds
  are currently an admin process), confirmation email delivery, client can
  log in to the new Stripe dashboard.

## 7. Media status

No client photo/video assets are present in the repository
(`public/img` holds 3 pre-existing stock images; `public/merch` product shots
are unrelated). The downloaded September assets live outside the repo —
**awaiting mapping (Q13)**. When mapped: upload via Admin → Venues → Media
(existing `venue_photos` storage flow), or set `hero_image`. The carousel and
venue pages already degrade gracefully with fallbacks, so missing media never
breaks layout. Recommendation: keep video in Supabase Storage, not git.

## 8. Feature flags & environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_ENABLE_POSTCODE_VENUE_FINDER` | unset → **off** | Paid postcode→nearest-venue finder (unapproved, Q16) |

Postcode finder estimate if approved: server-side edge function using the
provider from Nullshift's Schools Out product, normalised/validated UK
postcodes, cached lookups, rate limiting, Haversine sort over confirmed
public venues with coordinates (the sort/UI patterns already exist in
`ClassBrowser`). Estimated 1–2 days including states + tests. Not on the
launch critical path.

All other env vars are unchanged — see `README.md` / `.env.example`.

## 9. Automated test results

`npm test` — **29 passing** (5 files): venue visibility & featured ordering,
class time/age validation, audience labels (incl. "O17"/"16+U" preserved
verbatim), invite-only & provisional booking gates, carousel rendering/order/
accessibility/fallback image, feature flag default-off. Production build and
`tsc --noEmit` clean.

Not covered automatically (documented manual checks): SQL seed idempotency
(run the seed twice — second run inserts 0 rows), Stripe webhook replay
(Deno edge function; use Stripe CLI against staging).

## 10. Manual UAT checklist

**Admin:** create/edit a venue; set provisional → confirm it auto-hides;
feature 3 venues and reorder; create one class of each type (age-banded,
school-year, adult, invite-only); try an end time ≤ start time (blocked);
preview public site; confirm hidden/provisional badges.

**Parent:** browse venues/classes by day; verify age & school-year labels and
12h/24h times; verify the carousel on mobile + desktop incl. keyboard nav;
verify invite-only message and that it cannot be booked or carted; verify
"Booking Opening Soon" on unpriced classes; complete/cancel a test payment;
receive the confirmation email; verify no provisional class is visible.

**Operational:** staging deploy; run migration + seed twice; check env vars;
confirm old Stripe account absent; performance check once real images land.

## 11. Open blockers (require client/owner answers — nothing guessed)

Q1 Bolford Hall spelling/address · Q2 White Court duplicate ·
Q3 NEXUS 15-min slot · Q4 "O17" meaning · Q5 "16+U" meaning ·
Q6 competition-team access rules · Q7 SURGE/Mini Street concurrency ·
Q8 Harrow final confirmation · Q9 Coval Lane one-or-two venues ·
Q10/Q11 provisional Monday times · Q12 which three venues to feature ·
Q13 asset→venue mapping · Q14 term dates for session generation ·
Q15 full addresses/postcodes · Q16 postcode-finder approval ·
Q17 email scope confirmation (emails exist; confirm they're in the agreed
scope) · Q18 invite-only UX choice (currently: visible, clearly labelled,
non-bookable) · Q19 prices/capacities/instructors per class ·
Q20 which classes get "new" badges.

## 12. Deployment & rollback

Deploy: `supabase db push` → run seed → deploy frontend build → (operator)
Stripe secrets/webhooks as §6 → staging UAT → production.
Rollback: frontend is a static build (redeploy previous); DB changes are
additive — either leave columns in place (harmless) or drop them; seed rows
can be removed by slug (`DELETE FROM classes WHERE venue_id IN (SELECT id
FROM venues WHERE slug IN (…));` then the venues) if ever required.
