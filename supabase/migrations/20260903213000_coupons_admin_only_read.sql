-- Coupons now carry personal credit codes: a family's email and an admin
-- note about money owed. Checkout validates codes through the service role
-- (validate-coupon / create-payment-intent), so parents never need to read
-- the table directly — and shouldn't be able to list other families' codes.
drop policy if exists "Authenticated users can view active coupons" on public.coupons;
