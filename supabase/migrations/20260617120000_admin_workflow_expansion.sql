-- Admin workflow expansion (ability/gender, venue photos+contracts+access,
-- staff docs/expiry/secondary contacts, instructor roles + pay overrides,
-- party venue link, type-of-class links). All additive / non-destructive.

-- ===== Classes: ability level + gender =====
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS ability_level text;          -- Beginner|Improver|Intermediate|Advanced|All Levels (interpreted as minimum & above)
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS gender text DEFAULT 'mixed';   -- boys|girls|mixed

-- ===== Type of Class (workshops): multiple raw links (replaces single youtube_url in UI) =====
ALTER TABLE public.workshops ADD COLUMN IF NOT EXISTS links text[] NOT NULL DEFAULT '{}';

-- ===== Venues: waiting area, access code, contract renewal + notify lead time =====
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS has_waiting_area boolean NOT NULL DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS access_code text;              -- visible to staff + admin
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS contract_renewal_date date;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS contract_notify_weeks integer; -- 1,2,3 (weeks) or 4 (= 1 month)

-- ===== Venue photo galleries (multiple per outside/indoor/parking) =====
CREATE TABLE IF NOT EXISTS public.venue_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('outside','indoor','parking')),
  file_path text NOT NULL,
  caption text,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_venue_photos_venue ON public.venue_photos(venue_id);
ALTER TABLE public.venue_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view venue photos" ON public.venue_photos
  FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage venue photos" ON public.venue_photos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== Party packages: link a venue so capacity can auto-fill =====
ALTER TABLE public.party_packages ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL;

-- ===== Instructors: lead/assistant role + per-assignment pay override (classes & camps) =====
ALTER TABLE public.class_instructors          ADD COLUMN IF NOT EXISTS instructor_role text NOT NULL DEFAULT 'assistant';
ALTER TABLE public.class_instructors          ADD COLUMN IF NOT EXISTS pay_per_hour_override numeric;
ALTER TABLE public.session_instructors        ADD COLUMN IF NOT EXISTS instructor_role text NOT NULL DEFAULT 'assistant';
ALTER TABLE public.session_instructors        ADD COLUMN IF NOT EXISTS pay_per_hour_override numeric;
ALTER TABLE public.camp_instructors           ADD COLUMN IF NOT EXISTS instructor_role text NOT NULL DEFAULT 'assistant';
ALTER TABLE public.camp_instructors           ADD COLUMN IF NOT EXISTS pay_per_hour_override numeric;
ALTER TABLE public.camp_session_instructors   ADD COLUMN IF NOT EXISTS instructor_role text NOT NULL DEFAULT 'assistant';
ALTER TABLE public.camp_session_instructors   ADD COLUMN IF NOT EXISTS pay_per_hour_override numeric;
-- Existing single-instructor assignments become the lead.
UPDATE public.class_instructors SET instructor_role = 'main' WHERE instructor_role = 'assistant';
UPDATE public.camp_instructors  SET instructor_role = 'main' WHERE instructor_role = 'assistant';

-- ===== Staff: middle name, start date, secondary contacts, DBS update service, expiries =====
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS middle_name text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS start_date date;                 -- date joined TDE (admin-set)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS secondary_phone text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS secondary_nok_name text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS secondary_nok_phone text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS secondary_nok_relationship text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_update_service boolean NOT NULL DEFAULT false;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_expiry_date date;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pli_expiry_date date;

-- ===== Staff documents (multiple files + expiry: first aid, safeguarding, etc.) =====
CREATE TABLE IF NOT EXISTS public.staff_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('paediatric_first_aid','other_first_aid','safeguarding','dbs','pli','other')),
  file_path text NOT NULL,
  label text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_documents_staff ON public.staff_documents(staff_id);
ALTER TABLE public.staff_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage staff documents" ON public.staff_documents
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Staff manage own documents" ON public.staff_documents
  FOR ALL TO authenticated USING (staff_id = public.get_staff_id_for_user(auth.uid()))
  WITH CHECK (staff_id = public.get_staff_id_for_user(auth.uid()));
