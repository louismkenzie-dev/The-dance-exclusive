
-- Join table for multiple default instructors per class
CREATE TABLE public.class_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, staff_id)
);

ALTER TABLE public.class_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage class instructors"
  ON public.class_instructors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view class instructors"
  ON public.class_instructors FOR SELECT
  USING (true);

-- Join table for multiple instructors per session
CREATE TABLE public.session_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, staff_id)
);

ALTER TABLE public.session_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage session instructors"
  ON public.session_instructors FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view session instructors"
  ON public.session_instructors FOR SELECT
  USING (true);
