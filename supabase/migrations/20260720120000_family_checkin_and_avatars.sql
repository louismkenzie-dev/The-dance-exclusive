-- Family check-in revision + avatar support.
-- 1) Family PIN: 4-digit shared secret per parent account, used as the
--    safeguarding-grade backup when a QR code isn't available (staff verify
--    the PIN verbally, then mark attendance manually with a collector name).
-- 2) Staff may read the parent profile behind bookings in classes they teach
--    (name/phone/PIN — needed for safeguarding and the PIN check; previously
--    RLS hid parent contact info from staff entirely).
-- 3) Avatar columns for the Dance Exclusive cartoon avatar feature.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pickup_pin text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url text;

-- Backfill a random 4-digit PIN for every existing account.
UPDATE public.profiles
SET pickup_pin = lpad((floor(random() * 10000))::int::text, 4, '0')
WHERE pickup_pin IS NULL;

-- New accounts get a PIN automatically.
CREATE OR REPLACE FUNCTION public.set_pickup_pin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.pickup_pin IS NULL THEN
    NEW.pickup_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_pickup_pin ON public.profiles;
CREATE TRIGGER profiles_set_pickup_pin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_pickup_pin();

-- Staff can view the profiles of parents who have bookings in classes they
-- teach (safeguarding: contact info + Family PIN verification at the door).
DO $$ BEGIN
  CREATE POLICY "Staff view parent profiles for own classes"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.parent_id = profiles.user_id
        AND public.staff_teaches_class(public.get_staff_id_for_user(auth.uid()), b.class_id)
    )
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
