
-- Add comprehensive child profile fields to students table
ALTER TABLE public.students
  ADD COLUMN profile_photo text,
  ADD COLUMN medical_conditions_list text[] NOT NULL DEFAULT '{}',
  ADD COLUMN has_inhaler boolean NOT NULL DEFAULT false,
  ADD COLUMN has_epipen boolean NOT NULL DEFAULT false,
  ADD COLUMN allergies_list text[] NOT NULL DEFAULT '{}',
  ADD COLUMN has_send boolean NOT NULL DEFAULT false,
  ADD COLUMN send_conditions_list text[] NOT NULL DEFAULT '{}',
  ADD COLUMN send_details text,
  ADD COLUMN send_triggers_coping jsonb DEFAULT '{}',
  ADD COLUMN ehcp_in_place boolean NOT NULL DEFAULT false,
  ADD COLUMN one_to_one_required boolean NOT NULL DEFAULT false,
  ADD COLUMN is_toilet_trained boolean NOT NULL DEFAULT true,
  ADD COLUMN toileting_notes text,
  ADD COLUMN wears_nappies boolean NOT NULL DEFAULT false,
  ADD COLUMN prone_to_accidents boolean NOT NULL DEFAULT false,
  ADD COLUMN dance_style_preference text,
  ADD COLUMN ability_level text,
  ADD COLUMN has_stage_experience boolean NOT NULL DEFAULT false,
  ADD COLUMN child_hook text,
  ADD COLUMN photo_consent boolean NOT NULL DEFAULT true,
  ADD COLUMN social_media_consent boolean NOT NULL DEFAULT false;

-- Create storage bucket for student photos
INSERT INTO storage.buckets (id, name, public) VALUES ('student-photos', 'student-photos', true);

-- Storage policies for student photos
CREATE POLICY "Parents can upload student photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Parents can update student photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view student photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

CREATE POLICY "Parents can delete student photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'student-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
