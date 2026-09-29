-- A ledger of money actually received, and where it is attributed.
--
-- Until now the app never recorded a single payment. Everything was inferred from what things
-- COST — memberships.monthly_amount, bookings.amount — never what was COLLECTED, so a paused
-- membership, a £12 adjustment, a free month or a failed card were all invisible to anything
-- that tried to add up a month.
--
-- These rows are written only by payments-sync, which reads Stripe's balance transactions on the
-- connected account. That is the one place the gross, Stripe's fee and the Nullshift 1% exist
-- together, and it is Stripe's own statement of money — so net here is net in the bank.
--
-- Deliberately separate from everything that fulfils a booking. Nothing in the payment path writes
-- here, and nothing here is read by the payment path.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  -- Stripe's id for the ledger line. Unique, so re-syncing a month is harmless.
  balance_transaction_id text not null unique,
  stripe_env text not null default 'live',
  type text not null check (type in ('charge', 'refund', 'adjustment')),
  charge_id text,
  payment_intent_id text,
  invoice_id text,
  kind text not null default 'unknown'
    check (kind in ('membership', 'class', 'camp', 'pass', 'party', 'merch', 'unknown')),
  parent_id uuid,
  gross_pence integer not null,
  stripe_fee_pence integer not null default 0,
  platform_fee_pence integer not null default 0,
  net_pence integer not null,
  currency text not null default 'gbp',
  -- When the money moved. Reports are cash basis: a payment counts in the month it landed.
  occurred_at timestamp with time zone not null,
  description text,
  synced_at timestamp with time zone not null default now(),
  -- Stripe's net is gross minus fees, exactly. If a row ever disagrees, refuse it rather than
  -- store a figure that does not add up.
  constraint payments_net_adds_up check (net_pence = gross_pence - stripe_fee_pence - platform_fee_pence)
);

create index if not exists payments_occurred_at_idx on public.payments (occurred_at);
create index if not exists payments_charge_idx on public.payments (charge_id);
create index if not exists payments_payment_intent_idx on public.payments (payment_intent_id);

create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  kind text not null
    check (kind in ('membership', 'class', 'camp', 'pass', 'party', 'merch', 'unknown')),
  -- set null, not cascade: deleting a class must not delete the record that it once earned money.
  class_id uuid references public.classes(id) on delete set null,
  camp_id uuid references public.camps(id) on delete set null,
  venue_id uuid references public.venues(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  gross_pence integer not null,
  stripe_fee_pence integer not null default 0,
  platform_fee_pence integer not null default 0,
  net_pence integer not null,
  constraint payment_allocations_net_adds_up
    check (net_pence = gross_pence - stripe_fee_pence - platform_fee_pence)
);

create index if not exists payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index if not exists payment_allocations_class_idx on public.payment_allocations (class_id);
create index if not exists payment_allocations_venue_idx on public.payment_allocations (venue_id);

-- ---------------------------------------------------------------- who can see it
--
-- Admin only. No staff policy and no parent policy, on either table: a coach seeing what their
-- class turns over is exactly the kind of thing that cannot be taken back once it has been seen.
-- There is no insert or update policy at all — only payments-sync, with the service role, writes.

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;

drop policy if exists "Admins read payments" on public.payments;
create policy "Admins read payments"
  on public.payments for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins read payment allocations" on public.payment_allocations;
create policy "Admins read payment allocations"
  on public.payment_allocations for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------- the report
--
-- Turnover for a date range, grouped every way the Reports page needs: franchise, venue, class
-- and kind. The page sums further up in the browser.
--
-- A venue with no franchise comes back with franchise_id null and is labelled on the page as
-- uncategorised — a hall added next year is flagged, never quietly counted as Amie's. Money with
-- no venue at all (a class pass, a party, anything unmatched) comes back with venue_id null.

create or replace function public.report_revenue(_from timestamptz, _to timestamptz)
returns table (
  franchise_id uuid,
  franchise_name text,
  franchisee_name text,
  is_head_office boolean,
  venue_id uuid,
  venue_name text,
  class_id uuid,
  class_name text,
  kind text,
  gross_pence bigint,
  stripe_fee_pence bigint,
  platform_fee_pence bigint,
  net_pence bigint,
  payment_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.name,
    f.franchisee_name,
    coalesce(f.is_head_office, false),
    v.id,
    v.name,
    c.id,
    c.name,
    a.kind,
    sum(a.gross_pence)::bigint,
    sum(a.stripe_fee_pence)::bigint,
    sum(a.platform_fee_pence)::bigint,
    sum(a.net_pence)::bigint,
    count(distinct p.id)::bigint
  from public.payment_allocations a
  join public.payments p on p.id = a.payment_id
  left join public.venues v on v.id = a.venue_id
  left join public.franchises f on f.id = v.franchise_id
  left join public.classes c on c.id = a.class_id
  where p.occurred_at >= _from
    and p.occurred_at < _to
    -- Authorisation inside the query, not a separate check that could be forgotten.
    and public.has_role(auth.uid(), 'admin')
  group by f.id, f.name, f.franchisee_name, f.is_head_office, v.id, v.name, c.id, c.name, a.kind;
$$;

grant execute on function public.report_revenue(timestamptz, timestamptz) to authenticated;

insert into public.app_settings (key, value, description)
values ('payments_sync_watermark', '',
        'When payments-sync last read Stripe. Empty means it has never run, and the next run reads all history.')
on conflict (key) do nothing;
