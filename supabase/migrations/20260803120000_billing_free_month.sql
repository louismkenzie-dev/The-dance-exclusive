-- New billing calendar: first payment at signup (August signups defer to
-- 5 September via a Stripe trial), recurring on the 5th of each month, and
-- 11 paid months a year — each subscription's 12th ("free") month is skipped
-- by the maintenance job. free_month is shared by every membership row on
-- the same Stripe subscription (families check out together).
alter table public.memberships
  add column if not exists free_month smallint
    check (free_month between 1 and 12),
  -- August signups save a card via a SetupIntent instead of paying an
  -- invoice; fulfilment is keyed off this id when the card save succeeds.
  add column if not exists stripe_setup_intent_id text;

-- Every existing live membership predates this model and was sold on the
-- "no payments in August" promise: their free month is August.
update public.memberships set free_month = 8 where free_month is null;
