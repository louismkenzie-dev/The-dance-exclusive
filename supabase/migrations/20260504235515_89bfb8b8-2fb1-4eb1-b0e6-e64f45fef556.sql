UPDATE public.bookings
SET status = 'cancelled',
    notes = COALESCE(notes, '') || ' [auto-cancelled: duplicate of 796c9c01-611b-4502-9916-9290ef8d853c — refund pi_3TOdEMKDLQxrY6in0HExQ6TG manually]'
WHERE id = 'ebcd784b-6b4f-4e8a-976a-90d2f02a4008';

CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_student_class
  ON public.bookings (student_id, class_id)
  WHERE status IN ('confirmed', 'pending_payment') AND student_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_unique_active_parent_class_no_student
  ON public.bookings (parent_id, class_id)
  WHERE status IN ('confirmed', 'pending_payment') AND student_id IS NULL;