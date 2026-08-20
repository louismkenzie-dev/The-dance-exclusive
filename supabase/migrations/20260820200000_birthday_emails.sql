-- One row per (child, year) birthday email — the claim that makes the
-- daily-reminders birthday send idempotent across re-runs and retries.
create table if not exists public.birthday_emails (
  student_id uuid not null references public.students(id) on delete cascade,
  year int not null,
  sent_at timestamptz not null default now(),
  primary key (student_id, year)
);

-- Service-role only: no policies — RLS blocks anon/authenticated access and
-- the maintenance job runs with the service key, which bypasses RLS.
alter table public.birthday_emails enable row level security;
