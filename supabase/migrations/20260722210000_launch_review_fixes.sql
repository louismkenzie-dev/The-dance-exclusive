-- Fixes from the launch adversarial review.

-- 1) The pass idempotency index was PARTIAL (WHERE payment_intent_id IS NOT NULL),
--    which Postgres cannot use as an ON CONFLICT arbiter without repeating the
--    predicate — so every pass upsert failed (42P10) and no pass was ever created.
--    A plain unique index works (NULLS DISTINCT means null payment_intent_id rows
--    never conflict, preserving the original permissiveness).
DROP INDEX IF EXISTS public.class_passes_pi_item_unique;
CREATE UNIQUE INDEX IF NOT EXISTS class_passes_pi_item_unique
  ON public.class_passes (payment_intent_id, cart_item_ref);

-- 2) Camp (holiday workshop) bookings had no duplicate protection, unlike class
--    bookings. Mirror the existing class guard so a webhook + status-poll race
--    can't create two bookings for the same camp/attendee.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_student_camp
  ON public.bookings (student_id, camp_id)
  WHERE status IN ('confirmed', 'pending_payment') AND camp_id IS NOT NULL AND student_id IS NOT NULL;

-- 3) Atomic pass-credit refund used by redeem-pass when a booking insert fails
--    mid-loop — a relative increment avoids clobbering concurrent redemptions.
CREATE OR REPLACE FUNCTION public.refund_pass_credits(p_pass_id uuid, p_amount int)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.class_passes
  SET sessions_remaining = sessions_remaining + p_amount,
      updated_at = now()
  WHERE id = p_pass_id;
$$;
