
-- Add DBS certificate fields
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_certificate_front text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_certificate_back text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_number text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dbs_issue_date date;

-- Add PLI fields
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pli_certificate text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pli_cover_level text;

-- Create storage bucket for staff documents
INSERT INTO storage.buckets (id, name, public) VALUES ('staff-documents', 'staff-documents', true) ON CONFLICT (id) DO NOTHING;

-- RLS policies for the bucket
CREATE POLICY "Admins can manage staff documents" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'staff-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (bucket_id = 'staff-documents' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Anyone can view staff documents" ON storage.objects FOR SELECT TO public USING (bucket_id = 'staff-documents');
