-- Waitlist for full classes: parents join when a class is at capacity and are
-- emailed by the daily-reminders job when a standing place opens up again.

create table if not exists public.class_waitlist (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  parent_id uuid not null,
  student_id uuid references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table public.class_waitlist enable row level security;

-- One waitlist entry per parent (optionally per child) per class.
create unique index if not exists class_waitlist_unique
  on public.class_waitlist (class_id, parent_id, coalesce(student_id, '00000000-0000-0000-0000-000000000000'::uuid));

create index if not exists class_waitlist_class_idx on public.class_waitlist (class_id);

create policy "Parents manage own waitlist entries" on public.class_waitlist
  for all
  using (auth.uid() = parent_id)
  with check (auth.uid() = parent_id);

create policy "Admins manage waitlist" on public.class_waitlist
  for all
  using (has_role(auth.uid(), 'admin'::app_role));

-- Aggregate enrolment counts so the class browser can show "class full"
-- without exposing other families' bookings (bookings RLS is per-parent).
-- Standing plans only — trials and drop-ins don't hold a permanent place.
create or replace function public.get_class_enrollment(_class_ids uuid[])
returns table (class_id uuid, confirmed_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select b.class_id, count(*)::bigint
  from bookings b
  where b.class_id = any(_class_ids)
    and b.status = 'confirmed'
    and b.booking_type in ('monthly', 'term', 'yearly')
  group by b.class_id
$$;
