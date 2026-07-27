-- "Dancer of the Week" tick on the register (Class4kids-style): stored on the
-- attendance row for that session so it's part of the register history.
alter table public.attendance
  add column if not exists dancer_of_week boolean not null default false;
