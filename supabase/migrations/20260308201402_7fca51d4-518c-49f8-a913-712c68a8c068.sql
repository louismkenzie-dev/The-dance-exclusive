
-- Add profile_photo column to staff table
ALTER TABLE public.staff ADD COLUMN profile_photo text NULL;

-- Create storage bucket for staff photos
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-photos', 'staff-photos', true);

-- Allow admins to upload staff photos
CREATE POLICY "Admins can upload staff photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to update staff photos
CREATE POLICY "Admins can update staff photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete staff photos
CREATE POLICY "Admins can delete staff photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'staff-photos' AND public.has_role(auth.uid(), 'admin'));

-- Allow anyone to view staff photos
CREATE POLICY "Anyone can view staff photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'staff-photos');
