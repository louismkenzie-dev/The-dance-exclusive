# Overnight Work Report — 19/20 July 2026

Everything below is **live in production** (merged to `main`, Vercel auto-deployed,
Supabase migrations applied, edge functions deployed). 38 automated tests pass.

---

## 1. Attendee profiles — required for EVERY booking (your main ask)

- **Adults booking for themselves now create their own attendee profile**
  ("My Attendee Profile" on the Account page, or prompted mid-booking): name,
  DOB, medical conditions/allergies, emergency contact, and **expected
  arrival & departure times**. Saved as a `students` row flagged `is_self`,
  so registers, QR check-in, attendance and safeguarding all work identically
  for adults and children.
- **Expected arrival/departure times are now required for children too**
  (added to the child form). Booking is blocked — with a friendly dialog to
  complete the profile — until they're filled in.
- **Server-side enforcement** in `create-payment-intent`: no payment can be
  taken for a booking without a complete attendee profile, even from a
  tampered client.
- The orphaned legacy `/book/:classId` page (which created *unpaid* bookings
  with no profile) now redirects into the real booking flow.

## 2. Registers & QR scanning — fixed

Root cause of "QR does nothing": scanning resolved the token and matched the
booking, then hit `if (!booking.student_id) return;` — a silent no-op for any
adult booking. Fixed, plus:

- Adult rows now render properly (name, Adult badge) instead of a blank "?" row;
  legacy adult bookings without profiles show "Adult attendee" and **are markable**.
- Registers show **Expected HH:MM → HH:MM** from the profile until actual
  check-in/out times replace them; the staff profile drawer shows them too.
- All attendance writes now **surface errors** (previously every failure
  showed a success toast) and use **upserts** against a new unique
  `(booking, session)` index — no more duplicate-row races.
- Staff "clear status" used DELETE, which staff RLS silently blocks — now an
  UPDATE (works under existing policies).
- Staff register date bug fixed (UTC → local; it opened yesterday's register
  after 11pm BST).
- Scan → check-in stamps `checked_in_at`; second scan stamps departure — the
  arrival/departure times you asked for are recorded per scan.

## 3. "Payment complete" experience — fixed (the real bug was hosting)

The payment form redirects to `/checkout/return` with a full page load — and
the repo had **no `vercel.json`**, so Vercel returned 404 for any deep link.
Parents paid, hit a 404, and their basket kept the paid item (that's the
error you saw). Fixed:

- `vercel.json` SPA rewrites — all client routes now survive full page loads.
- Basket clears **at the moment of payment success** and remote cart rows are
  deleted immediately (previously a stale server cart could resurrect paid items).
- The confirmation page now retries the status check, falls back to asking
  Stripe directly from the browser, and **never shows an error for a payment
  Stripe reported as succeeded**. The success screen shows payment summary +
  each booking's class/venue/times.

## 4. Admin: create classes & assign staff — unblocked

Why you couldn't assign staff: the class wizard requires a "Type of Class"
(step 1) and a future school term (step 2) before the Staffing step —
and the database had **zero of both**. Also `invite-staff` (and two more
functions) had never been deployed, so adding staff 404'd.

- Seeded **1 provisional term** ("Autumn Term 2026 (provisional — confirm
  dates)", 7 Sep–18 Dec — edit in Settings → Term Dates; blocker Q14) and
  **10 Type of Class templates** matching the September timetable (no prices
  — set per class).
- **New "Staff" button on every class card** → quick Assign Staff dialog
  (choose instructors + main) without re-running the wizard. Works for all
  42 imported September classes.
- Deployed `invite-staff`, `admin-manage-admins`, `send-password-reset`.
  Note: invite-staff gracefully returns the invite link for manual sharing
  while email is down (see §6).
- Wizard now signposts when no Type of Class exists.
- I assigned **Sarah Stevens** as instructor of the TEST class so your
  staff-side register/QR test works immediately.

## 5. End-to-end verification (what I could test without a browser/human)

| Check | Result |
|---|---|
| Migrations applied (profiles, attendance unique index) | ✅ live |
| Edge functions deployed (12 total, incl. 3 previously missing) | ✅ ACTIVE |
| Sandbox Connect payment → connected account + 1% fee | ✅ proven by your £20 test (PI on `acct_…RazC`; fee 20p — confirm in platform test dashboard → Collected fees) |
| Booking + webhook + duplicate-guard | ✅ verified in DB/logs |
| TEST class visible & bookable (4 upcoming sessions, £5) | ✅ |
| Staff assigned to TEST class; instructor has a login | ✅ |
| QR token exists for your booking; scan path fixed | ✅ code-verified (physical scan needs your phone) |
| Frontend build, typecheck, lint (new files), 38 unit tests | ✅ |

**Needs a human tomorrow (5 min):** one sandbox booking end-to-end on the
preview URL (you'll now be asked to create your attendee profile first —
that's the new gate working), see the success page, then staff-login →
Registers → scan the QR from My Bookings → row turns "Arrived" with time.

## 6. Flagged issues that need YOU (can't be fixed from code)

1. **Emails are down: `RESEND_API_KEY` is not set** in Supabase edge-function
   secrets (confirmed: the 500s come from the missing-key guard; Resend
   rejections would be 502). Set `RESEND_API_KEY` (+ `EMAIL_FROM` once a
   domain is verified in Resend). Until a domain is verified, Resend test
   keys only deliver to the Resend account owner's own address.
2. **No venue has coordinates, and all 12 September venues have empty
   postcodes** (client blocker Q15 — never supplied). The postcode search
   works and degrades gracefully, but it can't *sort* venues until addresses
   are entered in Admin → Venues. Ten minutes of data entry once Amie
   confirms addresses.
3. Confirm/edit the provisional Autumn term dates (Q14) — sessions generated
   from it inherit whatever dates you set.

## 7. Suggested next improvements (not implemented — want your OK)

- Auto-geocode venues on save when a postcode is entered (free postcodes.io).
- Booking-time capacity check (capacity is stored but not enforced at checkout).
- Staff rota view: "my week" list across days rather than per-day register.
- Parent-facing "upcoming session" reminders once email is fixed.

## Housekeeping reminders

- TEST Payment Class + its bookings should be deleted before launch (tell me).
- The £20 sandbox test charge can be refunded in the Stripe test dashboard.
- Permission note: I can't enable bypass-permissions from inside the session —
  it's in your Claude session settings. Everything went through tonight anyway.
