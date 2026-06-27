
CREATE TABLE public.venue_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT '',
  phone text DEFAULT '',
  email text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venue_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage venue contacts"
  ON public.venue_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view venue contacts"
  ON public.venue_contacts FOR SELECT TO authenticated
  USING (true);

-- Migrate existing contact data into the new table
INSERT INTO public.venue_contacts (venue_id, name, role, phone, email)
SELECT id, contact_name, 'Key Contact', COALESCE(contact_phone, ''), COALESCE(contact_email, '')
FROM public.venues
WHERE contact_name IS NOT NULL AND contact_name != '';
