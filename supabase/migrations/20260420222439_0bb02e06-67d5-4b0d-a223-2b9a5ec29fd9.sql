-- 1. Add 'staff' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 2. Add invitation tracking columns to staff table
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 3. Index for fast lookup of staff by user_id
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON public.staff(user_id);

-- 4. Helper: get current staff id for a user (security definer, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_staff_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.staff WHERE user_id = _user_id LIMIT 1;
$$;

-- 5. Helper: check if a staff member is assigned to a given session (default OR explicit)
CREATE OR REPLACE FUNCTION public.staff_teaches_session(_staff_id UUID, _session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Explicit per-session assignment
    SELECT 1 FROM public.session_instructors
    WHERE session_id = _session_id AND staff_id = _staff_id
  ) OR EXISTS (
    -- Default class-level assignment (with no per-session override)
    SELECT 1
    FROM public.class_sessions cs
    JOIN public.class_instructors ci ON ci.class_id = cs.class_id
    WHERE cs.id = _session_id
      AND ci.staff_id = _staff_id
      AND NOT EXISTS (
        SELECT 1 FROM public.session_instructors si WHERE si.session_id = _session_id
      )
  );
$$;

-- 6. Helper: check if a staff member teaches a given class (any session)
CREATE OR REPLACE FUNCTION public.staff_teaches_class(_staff_id UUID, _class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_instructors
    WHERE class_id = _class_id AND staff_id = _staff_id
  ) OR EXISTS (
    SELECT 1
    FROM public.session_instructors si
    JOIN public.class_sessions cs ON cs.id = si.session_id
    WHERE cs.class_id = _class_id AND si.staff_id = _staff_id
  );
$$;

-- 7. Staff availability table
CREATE TABLE IF NOT EXISTS public.staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week public.day_of_week NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  availability_type TEXT NOT NULL DEFAULT 'available' CHECK (availability_type IN ('available', 'preferred', 'unavailable')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_availability_staff ON public.staff_availability(staff_id);

ALTER TABLE public.staff_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all availability"
ON public.staff_availability FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff manage own availability"
ON public.staff_availability FOR ALL
TO authenticated
USING (staff_id = public.get_staff_id_for_user(auth.uid()))
WITH CHECK (staff_id = public.get_staff_id_for_user(auth.uid()));

CREATE TRIGGER update_staff_availability_updated_at
BEFORE UPDATE ON public.staff_availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Allow staff to update their own staff record (limited - admins still manage role/pay)
CREATE POLICY "Staff can update own profile"
ON public.staff FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 9. Allow staff to view attendance for sessions they teach
CREATE POLICY "Staff can view attendance for own sessions"
ON public.attendance FOR SELECT
TO authenticated
USING (
  class_session_id IS NOT NULL
  AND public.staff_teaches_session(public.get_staff_id_for_user(auth.uid()), class_session_id)
);

CREATE POLICY "Staff can mark attendance for own sessions"
ON public.attendance FOR UPDATE
TO authenticated
USING (
  class_session_id IS NOT NULL
  AND public.staff_teaches_session(public.get_staff_id_for_user(auth.uid()), class_session_id)
)
WITH CHECK (
  class_session_id IS NOT NULL
  AND public.staff_teaches_session(public.get_staff_id_for_user(auth.uid()), class_session_id)
);

CREATE POLICY "Staff can insert attendance for own sessions"
ON public.attendance FOR INSERT
TO authenticated
WITH CHECK (
  class_session_id IS NOT NULL
  AND public.staff_teaches_session(public.get_staff_id_for_user(auth.uid()), class_session_id)
);

-- 10. Allow staff to view bookings for classes they teach (so they can see who's enrolled)
CREATE POLICY "Staff can view bookings for own classes"
ON public.bookings FOR SELECT
TO authenticated
USING (public.staff_teaches_class(public.get_staff_id_for_user(auth.uid()), class_id));

-- 11. Allow staff to view students booked into their classes
CREATE POLICY "Staff can view students in own classes"
ON public.students FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.student_id = students.id
      AND public.staff_teaches_class(public.get_staff_id_for_user(auth.uid()), b.class_id)
  )
);
