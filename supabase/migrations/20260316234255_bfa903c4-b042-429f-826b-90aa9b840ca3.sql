
-- Party packages (Disco Party, Glow Party, etc.)
CREATE TABLE public.party_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  included_items TEXT[] NOT NULL DEFAULT '{}',
  price_1hr NUMERIC,
  price_1_5hr NUMERIC,
  max_guests INTEGER NOT NULL DEFAULT 18,
  extra_guest_price NUMERIC NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.party_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage party packages" ON public.party_packages
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active party packages" ON public.party_packages
  FOR SELECT TO public USING (true);

-- Party extras / add-ons
CREATE TABLE public.party_extras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.party_extras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage party extras" ON public.party_extras
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active party extras" ON public.party_extras
  FOR SELECT TO public USING (true);

-- Party inquiries (customer submissions)
CREATE TABLE public.party_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  venue_preference TEXT,
  birthday_child_name TEXT NOT NULL,
  birthday_child_age INTEGER,
  party_package_id UUID REFERENCES public.party_packages(id),
  selected_extras TEXT[] NOT NULL DEFAULT '{}',
  guest_count INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.party_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage party inquiries" ON public.party_inquiries
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can create party inquiries" ON public.party_inquiries
  FOR INSERT TO public WITH CHECK (true);
