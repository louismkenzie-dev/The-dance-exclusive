-- A third kind of register alert: an adult class a few hours away with fewer
-- than three booked on. Claimed here so the studio hears once per session.
alter table public.register_alerts
  drop constraint if exists register_alerts_kind_check;
alter table public.register_alerts
  add constraint register_alerts_kind_check
  check (kind in ('not_marked_present', 'not_departed', 'quiet_class'));
