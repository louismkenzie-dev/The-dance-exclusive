
-- Create storage bucket for venue photos
INSERT INTO storage.buckets (id, name, public) VALUES ('venue-photos', 'venue-photos', true);

-- Allow admins to upload venue photos
CREATE POLICY "Admins can upload venue photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'venue-photos' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to update venue photos
CREATE POLICY "Admins can update venue photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'venue-photos' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow admins to delete venue photos
CREATE POLICY "Admins can delete venue photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'venue-photos' AND
  public.has_role(auth.uid(), 'admin')
);

-- Allow anyone to view venue photos (public bucket)
CREATE POLICY "Anyone can view venue photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'venue-photos');

-- Add photo columns to venues table
ALTER TABLE public.venues
ADD COLUMN IF NOT EXISTS photo_outside TEXT,
ADD COLUMN IF NOT EXISTS photo_indoor TEXT,
ADD COLUMN IF NOT EXISTS photo_parking TEXT;
