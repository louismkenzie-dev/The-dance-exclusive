-- Party enquiry workflow: what Amie agreed with the family, and the two
-- payments (deposit to hold the date, balance before the party).

alter table public.party_inquiries
  add column if not exists agreed_date date,
  add column if not exists agreed_time text,
  add column if not exists agreed_venue text,
  add column if not exists quoted_total numeric(10,2),
  add column if not exists admin_notes text,
  add column if not exists responded_at timestamptz;

comment on column public.party_inquiries.agreed_date is
  'The date actually agreed with the family — may differ from their preferred_date.';
comment on column public.party_inquiries.admin_notes is
  'Internal notes. Never shown to the family.';

-- Deposit and balance invoices raised in Stripe for a party.
create table if not exists public.party_payments (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.party_inquiries(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'balance')),
  amount numeric(10,2) not null check (amount > 0),
  status text not null default 'sent' check (status in ('sent', 'paid', 'void')),
  due_date date,
  stripe_invoice_id text,
  stripe_env text not null default 'live',
  hosted_invoice_url text,
  sent_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists party_payments_inquiry_idx on public.party_payments(inquiry_id);
create unique index if not exists party_payments_stripe_invoice_idx
  on public.party_payments(stripe_invoice_id) where stripe_invoice_id is not null;

alter table public.party_payments enable row level security;

-- Admin-only: families see their invoice through Stripe's own hosted page,
-- not through the app, so no public read policy is needed.
create policy "Admins can manage party payments"
  on public.party_payments for all
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));
