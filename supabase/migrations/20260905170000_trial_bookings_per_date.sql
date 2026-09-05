-- A trial is a dated booking that stays 'confirmed' after the class, and the
-- class-level uniqueness rule counted it as the child's place in that class.
-- So a family whose child trialled Junior Hiphop could not then buy a
-- membership for Junior Hiphop: checkout refused, and so did Add a booking.
-- That is the exact family the trial exists to convert.
--
-- Trials belong with the other per-date bookings (session, pass, birthday):
-- one per student, class and date, and no bearing on whether the child may
-- hold a standing place in the class.
DROP INDEX IF EXISTS public.bookings_unique_active_student_class;

CREATE UNIQUE INDEX bookings_unique_active_student_class
  ON public.bookings (student_id, class_id)
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type NOT IN ('pass', 'birthday', 'session', 'trial');

DROP INDEX IF EXISTS public.bookings_unique_pass_session;

CREATE UNIQUE INDEX bookings_unique_pass_session
  ON public.bookings (student_id, class_id, (substring(notes from 'session (\d{4}-\d{2}-\d{2})')))
  WHERE status = ANY (ARRAY['confirmed'::booking_status, 'pending_payment'::booking_status])
    AND student_id IS NOT NULL
    AND booking_type IN ('pass', 'birthday', 'session', 'trial');
