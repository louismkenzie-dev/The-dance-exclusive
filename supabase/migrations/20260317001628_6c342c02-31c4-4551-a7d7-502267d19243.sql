
-- Merchandise items table
CREATE TABLE public.merchandise_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  description text,
  base_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchandise_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchandise items" ON public.merchandise_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active merchandise items" ON public.merchandise_items
  FOR SELECT TO public
  USING (is_active = true);

-- Merchandise sizes/variants
CREATE TABLE public.merchandise_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.merchandise_items(id) ON DELETE CASCADE,
  size text NOT NULL,
  color text,
  sku text,
  price_override numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchandise_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchandise variants" ON public.merchandise_variants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active merchandise variants" ON public.merchandise_variants
  FOR SELECT TO public
  USING (is_active = true);

-- Merchandise media/gallery
CREATE TABLE public.merchandise_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.merchandise_items(id) ON DELETE CASCADE,
  media_type text NOT NULL DEFAULT 'image',
  file_path text NOT NULL,
  caption text,
  sort_order integer DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchandise_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchandise media" ON public.merchandise_media
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view merchandise media" ON public.merchandise_media
  FOR SELECT TO public
  USING (true);

-- Merchandise bundles
CREATE TABLE public.merchandise_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  bundle_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchandise_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage merchandise bundles" ON public.merchandise_bundles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view active merchandise bundles" ON public.merchandise_bundles
  FOR SELECT TO public
  USING (is_active = true);

-- Bundle items junction
CREATE TABLE public.merchandise_bundle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.merchandise_bundles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.merchandise_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.merchandise_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bundle items" ON public.merchandise_bundle_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view bundle items" ON public.merchandise_bundle_items
  FOR SELECT TO public
  USING (true);

-- Storage bucket for merchandise images
INSERT INTO storage.buckets (id, name, public) VALUES ('merchandise-media', 'merchandise-media', true);

CREATE POLICY "Admins can upload merchandise media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'merchandise-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update merchandise media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'merchandise-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete merchandise media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'merchandise-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view merchandise media files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'merchandise-media');
