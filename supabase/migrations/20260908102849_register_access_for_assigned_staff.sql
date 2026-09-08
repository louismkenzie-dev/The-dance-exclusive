-- Staff assigned to a class must be able to open that class's register.
--
-- THE BUG: a per-session instructor row REPLACED the whole class-level team.
-- staff_teaches_session only fell back to class_instructors when the session
-- had no session_instructors rows *at all* — from anyone. The staffing
-- timetable routinely writes a per-session row for the main teacher, which
-- silently revoked every other assigned member of that class. Assistants were
-- hit hardest: they were correctly assigned, showed on the staffing timetable,
-- and could not open a single register.
--
-- THE RULE NOW: a per-session assignment ADDS cover staff for that one
-- session. It never removes the class-level team.
--
-- Separately: the studio lead (an active ceo_owner) can see every register.
-- These helpers gate register visibility, attendance marking, the door QR
-- scan and the safeguarding contact details behind it, so the lead override
-- belongs here rather than in each policy.
--
-- Mirrored client-side by src/lib/registerAccess.ts — KEEP THE TWO IN SYNC.

-- The studio lead: the owner, while their staff record is active. Deliberately
-- checks the staff table's own role rather than user_roles, because the lead
-- is not necessarily an app admin.
CREATE OR REPLACE FUNCTION public.is_studio_lead(_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = _staff_id
      AND is_active
      AND role = 'ceo_owner'
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_teaches_session(_staff_id UUID, _session_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _staff_id IS NOT NULL AND (
    -- The studio lead sees every session.
    public.is_studio_lead(_staff_id)
    -- Explicit per-session assignment (cover, or an extra pair of hands).
    OR EXISTS (
      SELECT 1 FROM public.session_instructors
      WHERE session_id = _session_id AND staff_id = _staff_id
    )
    -- Class-level assignment. No longer cancelled by somebody else's
    -- per-session row.
    OR EXISTS (
      SELECT 1
      FROM public.class_sessions cs
      JOIN public.class_instructors ci ON ci.class_id = cs.class_id
      WHERE cs.id = _session_id
        AND ci.staff_id = _staff_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_teaches_class(_staff_id UUID, _class_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _staff_id IS NOT NULL AND (
    public.is_studio_lead(_staff_id)
    OR EXISTS (
      SELECT 1 FROM public.class_instructors
      WHERE class_id = _class_id AND staff_id = _staff_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.session_instructors si
      JOIN public.class_sessions cs ON cs.id = si.session_id
      WHERE cs.class_id = _class_id AND si.staff_id = _staff_id
    )
  );
$$;

-- The lead reads registers for classes they are not assigned to, so the two
-- session-list policies that were previously admin-or-nothing need the same
-- allowance. Everything else already routes through the helpers above.
DO $$ BEGIN
  CREATE POLICY "Studio lead can view all class instructors"
  ON public.class_instructors FOR SELECT
  TO authenticated
  USING (public.is_studio_lead(public.get_staff_id_for_user(auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Studio lead can view all session instructors"
  ON public.session_instructors FOR SELECT
  TO authenticated
  USING (public.is_studio_lead(public.get_staff_id_for_user(auth.uid())));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
