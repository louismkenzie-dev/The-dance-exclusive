-- Adult class passes the studio sells. These were hard-coded in the app, so
-- the studio could not add its own; this table becomes the source of truth
-- and is seeded with exactly the four published packs, leaving prices and
-- validity windows unchanged. The app keeps the built-in list as a fallback,
-- so a read failure degrades to today's behaviour rather than to "unknown
-- pass" at checkout.
create table if not exists public.class_pass_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null,
  description text,
  sessions integer not null check (sessions > 0),
  price numeric not null check (price >= 0),
  -- Days the pass stays valid after purchase; null = same calendar week (Mon–Sun).
  window_days integer check (window_days is null or window_days > 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_pass_types enable row level security;

drop policy if exists "Anyone can view class pass types" on public.class_pass_types;
create policy "Anyone can view class pass types"
  on public.class_pass_types for select using (true);

drop policy if exists "Admins can manage class pass types" on public.class_pass_types;
create policy "Admins can manage class pass types"
  on public.class_pass_types for all using (has_role(auth.uid(), 'admin'::app_role));

insert into public.class_pass_types (code, label, description, sessions, price, window_days, sort_order)
values
  ('week_2', '2-Class Week Pass', 'Any 2 classes in the same calendar week (Mon–Sun)', 2, 20, null, 1),
  ('pack_4', '4-Class Pass', 'Any 4 classes within 6 weeks of purchase', 4, 40, 42, 2),
  ('pack_6', '6-Class Pass', 'Any 6 classes within 6 weeks of purchase', 6, 55, 42, 3),
  ('pack_8', '8-Class Pass', 'Any 8 classes within 6 weeks of purchase', 8, 70, 42, 4)
on conflict (code) do nothing;
