-- A published projection, maintained in the same transaction as a staff edit.
-- The private staff table and all its existing policies stay unchanged.
-- staff_public remains an invoker view; anonymous reads never touch staff.
begin;

lock table public.staff in share row exclusive mode;

create table public.published_coach_profiles (
  id uuid primary key references public.staff(id) on delete cascade,
  first_name text,
  profile_photo text,
  description text,
  dance_skills text[],
  role text,
  created_at timestamptz
);
alter table public.published_coach_profiles enable row level security;
revoke all on public.published_coach_profiles from public, anon, authenticated;
grant select on public.published_coach_profiles to anon, authenticated;
create policy "Published coach profiles are public"
  on public.published_coach_profiles for select to anon, authenticated using (true);

create schema if not exists private;
-- Only a staff-table trigger can invoke this function. It cannot be called
-- through the Data API, and it copies an explicit allowlist of public fields.
create function private.sync_published_coach_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_schema <> 'public' or tg_table_name <> 'staff' then
    raise exception 'This trigger is restricted to staff';
  end if;
  -- Browser writes have already passed staff RLS. Anonymous requests cannot
  -- publish; trusted database maintenance and service-role edits also sync.
  if (select auth.uid()) is null
    and coalesce(current_setting('role', true), 'none') not in ('none', 'postgres', 'service_role') then
    raise insufficient_privilege using message = 'A staff editor must be authenticated';
  end if;
  if new.is_active is true then
    insert into public.published_coach_profiles
      (id, first_name, profile_photo, description, dance_skills, role, created_at)
    values
      (new.id, coalesce(nullif(trim(new.first_name), ''), split_part(new.full_name, ' ', 1)),
       new.profile_photo, new.description, new.dance_skills, new.role, new.created_at)
    on conflict (id) do update set
      first_name = excluded.first_name, profile_photo = excluded.profile_photo,
      description = excluded.description, dance_skills = excluded.dance_skills,
      role = excluded.role, created_at = excluded.created_at;
  else
    delete from public.published_coach_profiles where id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_published_coach_profile() from public, anon, authenticated;

create trigger sync_published_coach_profile
after insert or update of first_name, full_name, profile_photo, description, dance_skills, role, created_at, is_active
on public.staff for each row execute function private.sync_published_coach_profile();

insert into public.published_coach_profiles
  (id, first_name, profile_photo, description, dance_skills, role, created_at)
select id, coalesce(nullif(trim(first_name), ''), split_part(full_name, ' ', 1)),
  profile_photo, description, dance_skills, role, created_at
from public.staff where is_active is true;

create or replace view public.staff_public with (security_invoker = true) as
  select id, first_name, profile_photo, description, dance_skills, role, created_at
  from public.published_coach_profiles;
grant select on public.staff_public to anon, authenticated;

comment on table public.published_coach_profiles is
  'Public fields for active coaches, maintained by staff edits. Never store private staff fields here.';

commit;
