
-- Add header_image column to party_packages
ALTER TABLE public.party_packages ADD COLUMN header_image text;

-- Create party_package_media table for gallery images and videos
CREATE TABLE public.party_package_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.party_packages(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image', -- 'image', 'video', 'youtube'
  file_path text NOT NULL, -- storage path for uploads, or YouTube URL
  caption text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.party_package_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage party package media" ON public.party_package_media
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view party package media" ON public.party_package_media
  FOR SELECT TO public
  USING (true);

-- Create storage bucket for party media
INSERT INTO storage.buckets (id, name, public) VALUES ('party-media', 'party-media', true);

-- Storage policies for party-media bucket
CREATE POLICY "Admins can upload party media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'party-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update party media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'party-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete party media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'party-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view party media" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'party-media');
