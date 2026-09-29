-- What Amie pays each franchisee, worked out for her.
--
-- Her method (WhatsApp, 30 Sep): money in, less the 1% booking fee and Stripe's fee, less the hall
-- hire, is the franchise's profit or loss for the month. Then: "they get 70% profit and [I] get
-- 30%", and "if they make a loss, I absorb it and start fresh next month". The Reports page does the
-- arithmetic from the ledger; this migration only adds the one number the franchise record lacks.
--
--   share_percent — head office's share of a franchise's PROFIT, before paying the franchisee the
--     rest. 30 for everyone today, per Amie. A setting rather than a constant so that a different
--     deal for one franchisee is a number she edits on the Reports page, not a code change. It never
--     applies to a loss: a loss pays out £0 and head office absorbs it.

alter table public.franchises
  add column if not exists share_percent numeric(5, 2) not null default 30
    constraint franchises_share_percent_range check (share_percent >= 0 and share_percent <= 100);

comment on column public.franchises.share_percent is
  'Percent of the franchise''s monthly PROFIT that head office keeps; the franchisee is paid the rest. A loss pays out 0 and is absorbed by head office.';
