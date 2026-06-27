
-- Extend venues table with detailed fields for dance school management
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS floor_type text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS has_mirrors boolean DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS has_sound_system boolean DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS has_changing_rooms boolean DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS has_parking boolean DEFAULT false;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS parking_details text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS accessibility_info text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS map_embed_url text;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS hire_cost_per_hour numeric;
ALTER TABLE public.venues ADD COLUMN IF NOT EXISTS hire_cost_notes text;

-- Venue facilities table for flexible facility management
CREATE TABLE IF NOT EXISTS public.venue_facilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.venue_facilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage venue facilities"
  ON public.venue_facilities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view venue facilities"
  ON public.venue_facilities FOR SELECT TO authenticated
  USING (true);
