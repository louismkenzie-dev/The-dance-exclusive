-- Camp registers: let attendance rows point at a camp day instead of a class
-- session. class_id becomes nullable (a camp booking has no class); the
-- unique index mirrors attendance_booking_session_unique so the register's
-- upsert works per camp day.
alter table public.attendance alter column class_id drop not null;
alter table public.attendance add column if not exists camp_id uuid references public.camps(id) on delete cascade;
alter table public.attendance add column if not exists camp_session_id uuid references public.camp_sessions(id) on delete set null;
create unique index if not exists attendance_booking_camp_session_unique on public.attendance (booking_id, camp_session_id);
create index if not exists idx_attendance_camp_session on public.attendance (camp_session_id);
