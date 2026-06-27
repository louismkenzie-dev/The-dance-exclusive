-- Recreate session_availability, which existed in the source project's generated
-- types but was never captured in a migration (applied out-of-band). Reconstructed
-- here so the schema is fully reproducible from migrations.
CREATE TABLE IF NOT EXISTS public.session_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  class_session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (staff_id, class_session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_availability_staff ON public.session_availability(staff_id);
CREATE INDEX IF NOT EXISTS idx_session_availability_session ON public.session_availability(class_session_id);

ALTER TABLE public.session_availability ENABLE ROW LEVEL SECURITY;

-- Admins manage everything.
CREATE POLICY "Admins manage session availability"
  ON public.session_availability FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Staff manage their own availability rows.
CREATE POLICY "Staff view own availability"
  ON public.session_availability FOR SELECT TO authenticated
  USING (staff_id = public.get_staff_id_for_user(auth.uid()));

CREATE POLICY "Staff insert own availability"
  ON public.session_availability FOR INSERT TO authenticated
  WITH CHECK (staff_id = public.get_staff_id_for_user(auth.uid()));

CREATE POLICY "Staff update own availability"
  ON public.session_availability FOR UPDATE TO authenticated
  USING (staff_id = public.get_staff_id_for_user(auth.uid()))
  WITH CHECK (staff_id = public.get_staff_id_for_user(auth.uid()));

CREATE POLICY "Staff delete own availability"
  ON public.session_availability FOR DELETE TO authenticated
  USING (staff_id = public.get_staff_id_for_user(auth.uid()));

CREATE TRIGGER update_session_availability_updated_at
  BEFORE UPDATE ON public.session_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
