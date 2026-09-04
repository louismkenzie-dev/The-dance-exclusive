-- Bookings are only ever created server-side (checkout fulfilment, admin
-- tools, pass redemption) with the service role. The original launch
-- policy let a signed-in parent insert their own bookings rows straight
-- through the API — any class, status 'confirmed', any amount — which the
-- app never needs and which would put a child on a register unpaid.
drop policy if exists "Parents can create bookings" on public.bookings;
