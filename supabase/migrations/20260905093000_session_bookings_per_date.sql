-- Pay-as-you-go bookings create one row PER DATE, the same way pass and
-- birthday redemptions do. bookings_unique_active_student_class still allowed
-- only one active booking per (student, class) for them, so picking three
-- dates inserted the first and rejected the rest — the admin "Add a booking"
-- dialog just reported "Could not create the booking", and no multi-date
-- pay-as-you-go booking has ever existed in this database.
--
-- This is the same fault fixed for passes in 20260723160000; that fix simply
-- never covered 'session'. Extend the two rules rather than invent a third:
-- the class-level rule now ignores per-date booking types, and the per-date
-- rule (keyed on the session date in the notes) now covers them.
DROP INDEX IF EXISTS public.bookings_unique_active_student_class;

CREATE UNIQUE INDEX bookings_unique_active_student_class
  ON public.bookings (student_id, class_id)
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type NOT IN ('pass', 'birthday', 'session');

-- One booking per student, class and session date, for every booking type
-- that is fulfilled a date at a time.
DROP INDEX IF EXISTS public.bookings_unique_pass_session;

CREATE UNIQUE INDEX bookings_unique_pass_session
  ON public.bookings (student_id, class_id, (substring(notes from 'session (\d{4}-\d{2}-\d{2})')))
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type IN ('pass', 'birthday', 'session');
