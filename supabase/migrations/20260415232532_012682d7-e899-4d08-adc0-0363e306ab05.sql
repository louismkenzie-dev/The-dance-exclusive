
CREATE TABLE public.shows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  venue_id UUID REFERENCES public.venues(id),
  show_date DATE,
  show_time TIME WITHOUT TIME ZONE DEFAULT '19:00',
  duration_minutes INTEGER DEFAULT 120,
  ticket_price NUMERIC DEFAULT 0,
  capacity INTEGER DEFAULT 100,
  tickets_sold INTEGER DEFAULT 0,
  class_type public.class_type NOT NULL DEFAULT 'children',
  dance_style TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active shows"
ON public.shows FOR SELECT
TO public
USING (is_active = true);

CREATE POLICY "Admins can manage shows"
ON public.shows FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_shows_updated_at
BEFORE UPDATE ON public.shows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
