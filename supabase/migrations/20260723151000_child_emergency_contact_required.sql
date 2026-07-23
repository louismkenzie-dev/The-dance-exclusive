-- Child profiles must carry an emergency contact name and a plausible phone
-- number (10–13 digits, optional +country prefix). Enforced in the database so
-- no client path can create a child without one. NOT VALID: legacy rows are
-- not retro-validated, but any new insert or edit must comply.
ALTER TABLE public.students
  ADD CONSTRAINT students_emergency_contact_required
  CHECK (
    COALESCE(is_self, false)
    OR (
      emergency_contact_name IS NOT NULL AND btrim(emergency_contact_name) <> ''
      AND emergency_contact_phone IS NOT NULL
      AND emergency_contact_phone ~ '^\+?[0-9 ()\-]{7,20}$'
      AND length(regexp_replace(emergency_contact_phone, '\D', '', 'g')) BETWEEN 10 AND 13
    )
  ) NOT VALID;
