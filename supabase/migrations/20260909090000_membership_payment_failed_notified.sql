-- When the family was last told a membership payment had failed. The nightly
-- job emails once per failure; a row that is past due with nothing here has
-- never been told, whichever path flipped its status.
alter table public.memberships
  add column if not exists payment_failed_notified_at timestamptz;
