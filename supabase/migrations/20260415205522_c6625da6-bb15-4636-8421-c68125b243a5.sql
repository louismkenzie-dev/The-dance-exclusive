
-- Add address and secondary phone fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN address_line1 text,
  ADD COLUMN address_line2 text,
  ADD COLUMN city text,
  ADD COLUMN county text,
  ADD COLUMN postcode text,
  ADD COLUMN secondary_phone text;

-- Create authorized_collectors table
CREATE TABLE public.authorized_collectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id uuid NOT NULL,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  relationship text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.authorized_collectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can manage own collectors"
  ON public.authorized_collectors FOR ALL
  USING (auth.uid() = parent_id)
  WITH CHECK (auth.uid() = parent_id);

CREATE POLICY "Admins can manage all collectors"
  ON public.authorized_collectors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_authorized_collectors_updated_at
  BEFORE UPDATE ON public.authorized_collectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
