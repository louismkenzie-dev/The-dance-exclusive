-- Self-service staff onboarding: admin generates a single-use link, the staff
-- member fills in their own details on a public form, and the submission
-- appears in the admin Staff list for review.
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- URL token — long and random; the public form exchanges it via the
  -- staff-onboard edge function (service role), never by direct table access.
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '14 days',
  used_at timestamptz,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL
);

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

-- Admins manage invites; the public form never touches this table directly
-- (the staff-onboard edge function validates tokens with the service role).
CREATE POLICY "Admins can manage staff invites"
  ON public.staff_invites FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
