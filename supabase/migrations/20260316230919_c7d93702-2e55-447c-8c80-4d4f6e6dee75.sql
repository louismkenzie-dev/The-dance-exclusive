
-- Camps table
CREATE TABLE public.camps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  workshop_id UUID REFERENCES public.workshops(id),
  venue_id UUID REFERENCES public.venues(id),
  class_type public.class_type NOT NULL DEFAULT 'children',
  dance_style TEXT,
  age_min INTEGER,
  age_max INTEGER,
  capacity INTEGER NOT NULL DEFAULT 20,
  price_per_day NUMERIC,
  price_total NUMERIC,
  start_date DATE,
  end_date DATE,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '16:00',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.camps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camps" ON public.camps FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view active camps" ON public.camps FOR SELECT TO public USING (true);

-- Camp sessions (individual days within a camp)
CREATE TABLE public.camp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camp sessions" ON public.camp_sessions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view camp sessions" ON public.camp_sessions FOR SELECT TO authenticated USING (true);

-- Camp default instructors
CREATE TABLE public.camp_instructors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID NOT NULL REFERENCES public.camps(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camp instructors" ON public.camp_instructors FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view camp instructors" ON public.camp_instructors FOR SELECT TO public USING (true);

-- Camp session-level instructor overrides
CREATE TABLE public.camp_session_instructors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.camp_sessions(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.camp_session_instructors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage camp session instructors" ON public.camp_session_instructors FOR ALL TO public USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view camp session instructors" ON public.camp_session_instructors FOR SELECT TO public USING (true);
