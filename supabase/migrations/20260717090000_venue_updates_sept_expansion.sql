-- September 2026 venue expansion support.
-- Venues gain lifecycle status, public visibility, featured-carousel controls,
-- a slug and public copy fields. Classes gain audience metadata (school years,
-- free-text audience label), invite-only access, a lifecycle status and
-- independent visibility/booking toggles. All additive / non-destructive.

-- ===== Venues =====
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS publicly_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS featured_order integer;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS hero_image text;

DO $$ BEGIN
  ALTER TABLE public.venues
    ADD CONSTRAINT venues_status_check
    CHECK (status IN ('confirmed','provisional','inactive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Some September venues arrive without a confirmed street address/postcode.
-- Never fabricate them: allow the columns to be empty until confirmed.
ALTER TABLE public.venues ALTER COLUMN address_line1 DROP NOT NULL;
ALTER TABLE public.venues ALTER COLUMN postcode DROP NOT NULL;

-- Backfill slugs for existing venues, then enforce uniqueness.
UPDATE public.venues
SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
-- De-duplicate any collisions by suffixing the row id.
UPDATE public.venues v
SET slug = v.slug || '-' || left(v.id::text, 8)
WHERE EXISTS (
  SELECT 1 FROM public.venues o
  WHERE o.slug = v.slug AND o.id <> v.id AND o.created_at < v.created_at
);
CREATE UNIQUE INDEX IF NOT EXISTS venues_slug_unique ON public.venues (slug) WHERE slug IS NOT NULL;

-- Deterministic featured ordering lookups.
CREATE INDEX IF NOT EXISTS idx_venues_featured ON public.venues (featured_order) WHERE is_featured;

-- ===== Classes =====
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_year_min integer;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_year_max integer;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS audience_label text;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS invite_only boolean NOT NULL DEFAULT false;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed';
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS publicly_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.classes
    ADD CONSTRAINT classes_status_check
    CHECK (status IN ('confirmed','provisional','draft','inactive'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Validation. NOT VALID so pre-existing rows are not blocked, but every new
-- or edited row is checked (end after start, coherent age/school-year ranges).
DO $$ BEGIN
  ALTER TABLE public.classes
    ADD CONSTRAINT classes_end_after_start CHECK (end_time > start_time) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.classes
    ADD CONSTRAINT classes_age_range_valid
    CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.classes
    ADD CONSTRAINT classes_school_year_range_valid
    CHECK (school_year_min IS NULL OR school_year_max IS NULL OR school_year_min <= school_year_max) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
