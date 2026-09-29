-- What Amie pays each franchisee, worked out for her.
--
-- Her method (WhatsApp, 30 Sep): money in, less the 1% booking fee and Stripe's fee, less the hall
-- hire, is the franchise's profit or loss for the month. The Reports page computes that from the
-- ledger; this migration only adds the two things the franchise record was missing.
--
--   share_percent — what Amie keeps of each franchise's money in (after card fees), before paying
--     out. 0 for everyone today, because her example keeps nothing. A setting rather than a
--     constant so that if it changes she edits a number, not the code.
--
--   staff_id — the franchisee's own staff record. Lets the statement point out a class at their
--     venue that somebody else leads (Kayleigh on Brad's Monday Mixed Street), because whether that
--     coach's pay comes off the payout is still Amie's to decide. Nothing is deducted for it.

alter table public.franchises
  add column if not exists share_percent numeric(5, 2) not null default 0
    constraint franchises_share_percent_range check (share_percent >= 0 and share_percent <= 100),
  add column if not exists staff_id uuid references public.staff(id) on delete set null;

comment on column public.franchises.share_percent is
  'Percent of the franchise''s money in (after Stripe and Nullshift fees) that head office keeps before paying out. 0 = none.';
comment on column public.franchises.staff_id is
  'The franchisee''s own staff record, so classes led by someone else can be pointed out on the statement.';

-- Seeded by id, checked against the staff table on 30 Sep.
update public.franchises set staff_id = 'f86e72f6-18a8-4784-9e64-114c638a0801'  -- Ella Woods
 where id = 'f0000000-0000-4000-8000-000000000002' and staff_id is null
   and exists (select 1 from public.staff where id = 'f86e72f6-18a8-4784-9e64-114c638a0801');
update public.franchises set staff_id = '117abc36-169f-4593-92ce-55deab6dd7e8'  -- Brad Higgins
 where id = 'f0000000-0000-4000-8000-000000000003' and staff_id is null
   and exists (select 1 from public.staff where id = '117abc36-169f-4593-92ce-55deab6dd7e8');
update public.franchises set staff_id = 'c1c05cb7-1845-4eec-9dc5-f80bf12e69a3'  -- Boo Morrison
 where id = 'f0000000-0000-4000-8000-000000000004' and staff_id is null
   and exists (select 1 from public.staff where id = 'c1c05cb7-1845-4eec-9dc5-f80bf12e69a3');
