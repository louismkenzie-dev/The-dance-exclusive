# Public site and booking integration — 27 September 2026

## This iteration

The public class URL now owns discovery, authentication and choosing a place. The photo banner stays visible above the existing booking details. Signed-out visitors open the existing sign-in/sign-up form on that page; authenticated parents see the existing class booking controls inline. Legacy `/book/:classId` links resolve to the corresponding public class URL.

The embedded booking surface reuses BookClass and QuickBookDialog: attendee selection, attendee profile setup, dates, plan rules, trial eligibility, invitations, waiting lists and monthly cancellation acknowledgement remain in the existing booking code. The public header includes the basket for signed-in users. Attendee lookup has loading/error/retry states, and an unknown booking history does not grant trial eligibility.

Homepage “On the timetable” now reuses the booking system's DateStrip and SessionRow, with audience, venue and date filters. It shows up to eight sessions from a three-week window beginning with the next published date; the class directory remains the photo-led grid with search and venue/day/audience filters.

## Styling and scope

Blue/dark public-site tokens surround the shared booking controls. Adult sections retain pink accents. Profile and monthly-notice dialogs carry the same theme. Inter is deliberately retained for operational booking controls to match the booking system the client wants to preserve; the three Impeccable detector font findings are intentional.

This is the first stage of the gradual booking-system style rollout. Account management, the standalone sign-in screen, protected member timetable and checkout retain their established layouts. Payment processing, database policies and live billing configuration were not changed.

Password sign-in stays at the selected class with the booking anchor. Signup confirmation and Google authentication carry the selected class path as their return URL; auth-provider fragments are left to Supabase. Return paths reject external/protocol-relative destinations and backslash/control-character variants. Existing Supabase redirect allow-list settings still apply.

## Verification

- Browser: real public data; children photo directory → White Court Street Dance → inline sign-in, preserving the URL and photo banner. Checked desktop and 390px mobile; no horizontal overflow.
- Browser: homepage venue/date filtering at desktop and mobile sizes, including White Court's published £91 term price and correct class link.
- Component tests: actual embedded booking controls using mocked accounts/data/cart; class details, attendee selection and basket payload; monthly notice; trial gate; profile setup; attendee lookup failure/retry; actual embedded sign-in form and return navigation.
- All 326 tests across 45 files pass with two workers. TypeScript check passes. Client and SSR builds pass. No new ESLint findings versus HEAD; existing legacy `any`/fast-refresh findings remain.
- Impeccable scanned the changed booking/public surfaces. Only the three intentional Inter findings remain.

Live account creation, email confirmation, Google OAuth and payment completion were not exercised. No real parent or child records or bookings were created for testing. This change is preview-only; production release and a real-account acceptance test remain separate steps.
