ALTER TABLE public.booking_qr_tokens
  ALTER COLUMN class_session_id DROP NOT NULL;

DROP POLICY IF EXISTS "Staff view tokens for own sessions" ON public.booking_qr_tokens;

CREATE POLICY "Staff view tokens for own classes"
  ON public.booking_qr_tokens
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_qr_tokens.booking_id
        AND staff_teaches_class(get_staff_id_for_user(auth.uid()), b.class_id)
    )
  );

-- One active per-booking token at a time (session-less)
CREATE UNIQUE INDEX IF NOT EXISTS booking_qr_tokens_one_per_booking
  ON public.booking_qr_tokens (booking_id)
  WHERE class_session_id IS NULL;