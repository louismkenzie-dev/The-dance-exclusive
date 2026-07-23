-- Pass/birthday redemptions create one booking PER SESSION of a class, but
-- bookings_unique_active_student_class allowed only one active booking per
-- (student, class) — so redeeming a pass against several weeks of the same
-- class booked the first session and rejected the rest (customer saw "booked
-- one instead of four"). Exclude per-session booking types from the
-- class-level uniqueness rule and give them their own per-session rule keyed
-- on the session date embedded in the booking notes.
DROP INDEX IF EXISTS public.bookings_unique_active_student_class;

CREATE UNIQUE INDEX bookings_unique_active_student_class
  ON public.bookings (student_id, class_id)
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type NOT IN ('pass', 'birthday');

-- One pass/birthday booking per student, class and session date. The session
-- date lives in the notes ("… session YYYY-MM-DD"), which redeem-pass always
-- writes for these booking types.
CREATE UNIQUE INDEX bookings_unique_pass_session
  ON public.bookings (student_id, class_id, (substring(notes from 'session (\d{4}-\d{2}-\d{2})')))
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type IN ('pass', 'birthday');
