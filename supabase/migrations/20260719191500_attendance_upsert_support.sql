-- Registers mark attendance with read-then-write logic that could create
-- duplicate rows per (booking, session) under double-taps or two staff
-- marking at once. Dedupe, then enforce uniqueness so the UIs can upsert.

-- Keep the most recent row per (booking_id, class_session_id).
DELETE FROM public.attendance a
USING public.attendance b
WHERE a.booking_id = b.booking_id
  AND a.class_session_id IS NOT DISTINCT FROM b.class_session_id
  AND a.class_session_id IS NOT NULL
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_booking_session_unique
  ON public.attendance (booking_id, class_session_id);
