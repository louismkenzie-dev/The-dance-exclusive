-- First-login admin tutorial: records when an admin completed (or skipped)
-- the getting-started tour, so it only auto-opens once per account.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_tour_completed_at timestamptz;
