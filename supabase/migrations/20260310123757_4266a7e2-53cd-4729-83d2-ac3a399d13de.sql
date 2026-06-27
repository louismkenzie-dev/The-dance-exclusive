
-- Allow public (unauthenticated) access to view venues
DROP POLICY IF EXISTS "Anyone authenticated can view venues" ON public.venues;
CREATE POLICY "Anyone can view venues" ON public.venues FOR SELECT TO public USING (true);

-- Allow public (unauthenticated) access to view staff
DROP POLICY IF EXISTS "Anyone authenticated can view staff" ON public.staff;
CREATE POLICY "Anyone can view staff" ON public.staff FOR SELECT TO public USING (true);
