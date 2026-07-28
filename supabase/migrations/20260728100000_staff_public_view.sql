-- Public, safe subset of staff for the marketing site ("Meet the Crew") and
-- class listings. This view intentionally runs with owner privileges
-- (SECURITY DEFINER behaviour) so it can bypass staff RLS to expose ONLY
-- these columns for active staff — because the staff table itself must stop
-- being publicly readable: it holds home addresses, dates of birth, pay
-- rates, DBS numbers and next-of-kin details.
create or replace view public.staff_public as
  select
    id,
    coalesce(nullif(trim(first_name), ''), split_part(full_name, ' ', 1)) as first_name,
    profile_photo,
    description,
    dance_skills,
    role,
    created_at
  from public.staff
  where is_active = true;

alter view public.staff_public owner to postgres;
grant select on public.staff_public to anon, authenticated;

-- Remove the blanket public read ("Anyone can view staff" USING true).
drop policy if exists "Anyone can view staff" on public.staff;

-- Staff still read their own record (portal profile, documents, registers).
create policy "Staff can view own profile" on public.staff
  for select using (user_id = auth.uid());

-- Public-site stats the studio sets by hand (history the platform can't
-- derive: founding year, dancers taught, titles won). Editable in
-- Admin → Settings → Company; consumed by the marketing pages.
insert into public.app_settings (key, value, description) values
  ('founded_year', '2019', 'Year the studio was founded — powers the "years running" stat on the public site'),
  ('stat_dancers', '500', 'Dancers taught so far — shown as "N+" on the public site'),
  ('stat_titles', '30', 'Competition titles & awards — shown as "N+" on the public site')
on conflict (key) do nothing;
