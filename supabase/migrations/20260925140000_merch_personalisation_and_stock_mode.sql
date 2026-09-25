-- Two catalogue changes Amie asked for on 25 Sep.
--
-- 1. Personalisation is a priced add-on, not a flag. She ticks which placements a garment offers
--    -- front, back, arm -- and sets a price for each, defaulting to £3.
-- 2. Stock is per item. Hoodies and tees are printed to order and can never run out; water
--    bottles and bags are physically held and can.
--
-- Both default to today's behaviour, so applying this changes nothing visible until Amie
-- configures a product.

-- ---------------------------------------------------------------- stock mode

alter table public.merchandise_items
  add column if not exists tracks_stock boolean not null default true;

comment on column public.merchandise_items.tracks_stock is
  'False for print-to-order goods, which have no stock and never sell out. True for goods held in stock.';

-- ---------------------------------------------------------------- personalisation

create table if not exists public.merchandise_personalisation_options (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.merchandise_items(id) on delete cascade,
  placement text not null check (placement in ('front', 'back', 'sleeve')),
  price numeric not null default 3 check (price >= 0),
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  unique (item_id, placement)
);

create index if not exists merchandise_personalisation_options_item_idx
  on public.merchandise_personalisation_options (item_id) where is_active;

alter table public.merchandise_personalisation_options enable row level security;

-- Mirrors the policies on merchandise_variants exactly.
drop policy if exists "Admins can manage merchandise personalisation" on public.merchandise_personalisation_options;
create policy "Admins can manage merchandise personalisation"
  on public.merchandise_personalisation_options
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Anyone can view active merchandise personalisation" on public.merchandise_personalisation_options;
create policy "Anyone can view active merchandise personalisation"
  on public.merchandise_personalisation_options
  for select to public
  using (is_active = true);

comment on table public.merchandise_personalisation_options is
  'Which personalisation placements a garment offers and what each costs. No rows = no personalisation offered.';
