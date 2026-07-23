-- Server-authoritative payments mode. Which Stripe environment (sandbox/live)
-- the platform charges in used to be chosen by the CLIENT (request body,
-- derived from the publishable-key prefix) — fine while everything was
-- sandbox, but once live keys exist a tampered request could force sandbox
-- and "pay" for real bookings with a test card. This row is now the single
-- switch: the payment edge functions and the frontend both read it.
--
-- The app_settings table itself (public read, admin-only write) already
-- exists — created in 20260310125632. Rows are publicly readable: the
-- payments mode maps to a publishable key that ships in every browser anyway.
--
-- Go-live flip:
--   update public.app_settings set value = 'live', updated_at = now()
--   where key = 'payments_mode';
insert into public.app_settings (key, value, description)
values (
  'payments_mode',
  'sandbox',
  'Which Stripe environment the platform charges in: sandbox | live. Read by the payment edge functions AND the frontend (single switch). Flip to live at go-live.'
)
on conflict (key) do nothing;
