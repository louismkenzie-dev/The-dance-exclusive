-- Merchandise orders.
--
-- Until now a uniform order went to Stripe and nothing came back: no record of
-- who bought what, in which size, and no stock movement — the studio had to
-- read the Stripe dashboard and guess. Every shop checkout now writes a
-- pending order first, and the payment webhook marks it paid, takes the stock
-- and emails the customer.

create table if not exists public.merchandise_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'paid', 'ready', 'collected', 'cancelled')),
  total_amount numeric(10, 2) not null default 0,
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.merchandise_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.merchandise_orders(id) on delete cascade,
  variant_id uuid references public.merchandise_variants(id) on delete set null,
  item_id uuid references public.merchandise_items(id) on delete set null,
  -- Names and prices are copied in, not joined: a receipt must still read
  -- correctly after a product is renamed, repriced or deleted.
  product_name text not null,
  size text,
  unit_price numeric(10, 2) not null default 0,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists merchandise_orders_user_idx on public.merchandise_orders (user_id);
create index if not exists merchandise_orders_status_idx on public.merchandise_orders (status, created_at desc);
create index if not exists merchandise_order_items_order_idx on public.merchandise_order_items (order_id);

alter table public.merchandise_orders enable row level security;
alter table public.merchandise_order_items enable row level security;

do $$ begin
  create policy "Admins manage merch orders" on public.merchandise_orders
    for all
    using (has_role(auth.uid(), 'admin'::app_role))
    with check (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Customers view own merch orders" on public.merchandise_orders
    for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins manage merch order items" on public.merchandise_order_items
    for all
    using (has_role(auth.uid(), 'admin'::app_role))
    with check (has_role(auth.uid(), 'admin'::app_role));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Customers view own merch order items" on public.merchandise_order_items
    for select
    using (
      exists (
        select 1 from public.merchandise_orders o
        where o.id = merchandise_order_items.order_id
          and o.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

drop trigger if exists update_merchandise_orders_updated_at on public.merchandise_orders;
create trigger update_merchandise_orders_updated_at
  before update on public.merchandise_orders
  for each row execute function public.update_updated_at_column();

-- Take the stock for a paid order, once. Runs as the service role from the
-- payments webhook; the guard on paid_at keeps a replayed webhook from
-- decrementing the same order twice. Stock never goes below zero — an
-- oversell is a counting problem for the studio, not a negative number.
create or replace function public.complete_merch_order(
  _order_id uuid,
  _payment_intent_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  _already boolean;
begin
  select paid_at is not null into _already
  from merchandise_orders
  where id = _order_id
  for update;

  if _already is null then
    return false; -- unknown order
  end if;
  if _already then
    return false; -- already fulfilled
  end if;

  update merchandise_orders
  set status = 'paid',
      paid_at = now(),
      stripe_payment_intent_id = coalesce(_payment_intent_id, stripe_payment_intent_id),
      updated_at = now()
  where id = _order_id;

  update merchandise_variants v
  set stock_quantity = greatest(0, v.stock_quantity - oi.quantity)
  from merchandise_order_items oi
  where oi.order_id = _order_id
    and oi.variant_id = v.id
    and v.stock_quantity is not null;

  return true;
end;
$$;
