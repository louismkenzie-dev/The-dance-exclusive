-- A code is now reserved the moment a checkout is priced with it, and
-- completed when the payment succeeds — so a single-use credit can't be
-- applied to two baskets at once. Reservations are keyed on the
-- PaymentIntent (existing partial unique index on payment_intent_id) and
-- expire if the checkout is abandoned.
alter table public.coupon_redemptions
  add column if not exists status text not null default 'completed'
    check (status in ('reserved','completed'));
create index if not exists coupon_redemptions_coupon_status_idx
  on public.coupon_redemptions (coupon_id, status, redeemed_at);
