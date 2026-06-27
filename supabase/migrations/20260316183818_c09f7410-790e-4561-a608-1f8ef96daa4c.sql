
-- School terms table
CREATE TABLE public.school_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  term_type text NOT NULL DEFAULT 'autumn',
  academic_year text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage school terms" ON public.school_terms FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view school terms" ON public.school_terms FOR SELECT USING (true);

-- School holidays table
CREATE TABLE public.school_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  holiday_type text NOT NULL DEFAULT 'half_term',
  academic_year text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage school holidays" ON public.school_holidays FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view school holidays" ON public.school_holidays FOR SELECT USING (true);

-- Add new pricing columns to classes
ALTER TABLE public.classes 
  ADD COLUMN IF NOT EXISTS price_per_month numeric,
  ADD COLUMN IF NOT EXISTS price_per_year numeric,
  ADD COLUMN IF NOT EXISTS monthly_discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS term_discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS year_discount_percent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS school_term_id uuid REFERENCES public.school_terms(id);
