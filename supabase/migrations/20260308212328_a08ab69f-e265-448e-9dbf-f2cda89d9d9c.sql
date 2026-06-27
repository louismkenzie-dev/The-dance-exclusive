-- Workshops table
CREATE TABLE public.workshops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  theme text,
  dance_style text,
  class_type public.class_type NOT NULL DEFAULT 'children',
  age_min integer,
  age_max integer,
  capacity integer DEFAULT 20,
  duration_minutes integer,
  price numeric,
  youtube_url text,
  cover_image text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Workshop media table for multiple images/videos
CREATE TABLE public.workshop_media (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  media_type text NOT NULL DEFAULT 'image',
  caption text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workshop_media ENABLE ROW LEVEL SECURITY;

-- RLS policies for workshops
CREATE POLICY "Admins can manage workshops" ON public.workshops FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active workshops" ON public.workshops FOR SELECT USING (true);

-- RLS policies for workshop_media
CREATE POLICY "Admins can manage workshop media" ON public.workshop_media FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view workshop media" ON public.workshop_media FOR SELECT USING (true);

-- Storage bucket for workshop media
INSERT INTO storage.buckets (id, name, public) VALUES ('workshop-media', 'workshop-media', true);

-- Storage policies
CREATE POLICY "Admins can upload workshop media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'workshop-media' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update workshop media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'workshop-media' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete workshop media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'workshop-media' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view workshop media files" ON storage.objects FOR SELECT USING (bucket_id = 'workshop-media');