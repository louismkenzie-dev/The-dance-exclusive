-- Register rules
--
-- 1. Nobody can mark a dancer as arrived before 15 minutes prior to the class
--    start on the day (Europe/London). Enforced in the database so the rule
--    holds for the staff register, the admin register and the QR paths alike.
-- 2. A log of the register alerts the studio has been sent — one row per
--    session per kind — so the five-minute check never emails twice.

create or replace function public.attendance_guard_early_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start  timestamptz;
  v_opens  timestamptz;
begin
  -- Only when an arrival is being recorded (a new or changed check-in time).
  if new.checked_in_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.checked_in_at is not distinct from new.checked_in_at then
    return new;
  end if;
  -- Camp sessions have no timed rule yet.
  if new.class_session_id is null then
    return new;
  end if;

  select (s.session_date + s.start_time) at time zone 'Europe/London'
    into v_start
    from public.class_sessions s
   where s.id = new.class_session_id;
  if v_start is null then
    return new;
  end if;

  v_opens := v_start - interval '15 minutes';
  if now() < v_opens then
    raise exception 'Arrivals open 15 minutes before the class starts — from % on %',
      to_char(v_opens at time zone 'Europe/London', 'HH24:MI'),
      to_char(v_opens at time zone 'Europe/London', 'FMDay DD Mon')
      using errcode = 'check_violation', hint = 'register_arrival_too_early';
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_guard_early_checkin on public.attendance;
create trigger attendance_guard_early_checkin
  before insert or update on public.attendance
  for each row execute function public.attendance_guard_early_checkin();

-- Register alerts sent to the studio: one per session per kind.
create table if not exists public.register_alerts (
  id uuid primary key default gen_random_uuid(),
  class_session_id uuid not null references public.class_sessions(id) on delete cascade,
  kind text not null check (kind in ('not_marked_present', 'not_departed')),
  attendee_count integer not null default 0,
  recipients text[] not null default '{}',
  emailed boolean not null default false,
  details jsonb,
  created_at timestamptz not null default now(),
  unique (class_session_id, kind)
);

alter table public.register_alerts enable row level security;

drop policy if exists "Admins can view register alerts" on public.register_alerts;
create policy "Admins can view register alerts"
  on public.register_alerts for select
  using (public.has_role(auth.uid(), 'admin'::app_role));

-- Writes come only from the register-alerts function (service role bypasses RLS).
