-- Every booking must have an attendee profile (children AND adults booking
-- for themselves) so registers and QR check-in always have age, medical and
-- expected arrival/departure information.

-- Adults booking for themselves get their own students row, flagged is_self.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false;

-- Expected arrival/departure times shown on class registers.
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS expected_arrival_time time;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS expected_departure_time time;

-- One self profile per account.
CREATE UNIQUE INDEX IF NOT EXISTS students_one_self_per_parent
  ON public.students (parent_id) WHERE is_self;
