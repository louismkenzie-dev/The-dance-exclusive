-- The public class browser (/classes/:type) is an unauthenticated page, but the
-- original "Anyone can view class sessions" policy was scoped to the authenticated
-- role only, so logged-out visitors saw zero sessions and every class was hidden.
-- classes/venues/staff are already public; align class_sessions with them.
DROP POLICY IF EXISTS "Anyone can view class sessions" ON public.class_sessions;
CREATE POLICY "Public can view class sessions" ON public.class_sessions
  FOR SELECT TO public USING (true);
