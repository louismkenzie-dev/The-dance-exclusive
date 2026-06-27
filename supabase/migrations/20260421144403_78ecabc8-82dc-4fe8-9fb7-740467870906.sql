-- Rotating per-session QR tokens for sign in/out
CREATE TABLE public.booking_qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  class_session_id UUID NOT NULL,
  student_id UUID,
  token TEXT NOT NULL UNIQUE,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_qr_tokens_token ON public.booking_qr_tokens(token);
CREATE INDEX idx_booking_qr_tokens_booking ON public.booking_qr_tokens(booking_id);
CREATE INDEX idx_booking_qr_tokens_session ON public.booking_qr_tokens(class_session_id);

ALTER TABLE public.booking_qr_tokens ENABLE ROW LEVEL SECURITY;

-- Parents can view tokens for their own bookings
CREATE POLICY "Parents view own booking tokens"
ON public.booking_qr_tokens FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.id = booking_qr_tokens.booking_id AND b.parent_id = auth.uid()
));

-- Parents can create tokens for their own bookings (auto-generate on demand)
CREATE POLICY "Parents create own booking tokens"
ON public.booking_qr_tokens FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bookings b
  WHERE b.id = booking_qr_tokens.booking_id AND b.parent_id = auth.uid()
));

-- Staff who teach the session can view tokens (to validate scans)
CREATE POLICY "Staff view tokens for own sessions"
ON public.booking_qr_tokens FOR SELECT
TO authenticated
USING (staff_teaches_session(get_staff_id_for_user(auth.uid()), class_session_id));

-- Admins manage all
CREATE POLICY "Admins manage all qr tokens"
ON public.booking_qr_tokens FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add a 'collector_name' column to attendance for safeguarding audit
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS collector_name TEXT,
  ADD COLUMN IF NOT EXISTS check_in_method TEXT,
  ADD COLUMN IF NOT EXISTS check_out_method TEXT;