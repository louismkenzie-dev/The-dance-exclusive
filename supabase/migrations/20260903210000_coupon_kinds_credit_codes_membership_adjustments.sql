-- Coupons: what a code can discount, and codes locked to one family.
-- Existing codes keep their holiday-workshop-only behaviour (the default).
alter table public.coupons
  add column if not exists applies_to_kinds text[] not null default '{camp}',
  add column if not exists restricted_to_email text;

comment on column public.coupons.applies_to_kinds is
  'Basket item kinds the code can discount: camp (holiday workshops), class (trial / pay-as-you-go / termly / yearly class bookings), monthly (the first payment of a new monthly membership), pass (adult class passes).';
comment on column public.coupons.restricted_to_email is
  'When set, only the account with this email can use the code — a personal credit code for one family.';

create index if not exists coupons_restricted_email_idx
  on public.coupons (lower(restricted_to_email)) where restricted_to_email is not null;

-- One-off change to a single month's membership charge (e.g. "£7 off February
-- because we owed them"). Reaches Stripe as a pending invoice item on the
-- subscription, so the card is actually charged the adjusted amount.
create table public.membership_adjustments (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.memberships(id) on delete cascade,
  user_id uuid not null,
  billing_month date not null,
  amount numeric(10,2) not null check (amount <> 0),
  reason text,
  status text not null default 'pending' check (status in ('pending','applied','removed')),
  stripe_invoice_item_id text,
  stripe_env text not null default 'sandbox' check (stripe_env in ('sandbox','live')),
  created_by uuid,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  removed_at timestamptz
);

comment on table public.membership_adjustments is
  'A one-off amount added to (positive) or taken off (negative) one month''s charge for a monthly membership. billing_month is the first day of the month the charge is taken in.';

create unique index membership_adjustments_active_month
  on public.membership_adjustments (membership_id, billing_month) where status <> 'removed';
create index membership_adjustments_user_idx on public.membership_adjustments (user_id);
create index membership_adjustments_pending_idx on public.membership_adjustments (status) where status = 'pending';

alter table public.membership_adjustments enable row level security;

create policy "Parents can view their own membership adjustments"
  on public.membership_adjustments for select
  using (user_id = auth.uid());

create policy "Admins can manage membership adjustments"
  on public.membership_adjustments for all
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
