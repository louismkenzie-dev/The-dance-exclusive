
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS next_of_kin_name text,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone text,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS drives boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS self_employed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pay_per_hour numeric,
  ADD COLUMN IF NOT EXISTS dance_skills text[] NOT NULL DEFAULT '{}';
