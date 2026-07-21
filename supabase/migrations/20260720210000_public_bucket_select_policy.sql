-- Fix: photo uploads with upsert:true failed with "new row violates
-- row-level security policy for table objects". INSERT ... ON CONFLICT DO
-- UPDATE (what storage-api runs for upsert) needs a SELECT policy to read
-- the conflict arbiter row, and none existed for these buckets. All of
-- these buckets are already public (anyone can read objects via their
-- public URL), so this policy grants nothing new — it only lets the
-- database see what the CDN already serves.
DO $$ BEGIN
  CREATE POLICY "Public bucket objects are readable"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN (
      'branding','merchandise-media','party-media','profile-photos',
      'staff-photos','student-photos','venue-photos','workshop-media'
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
