-- A backup emergency contact, for when the first one can't be reached.
-- Optional by design: the first contact stays the required one (enforced by
-- students_emergency_contact_required).
alter table public.students add column if not exists emergency_contact_2_name text;
alter table public.students add column if not exists emergency_contact_2_phone text;
alter table public.students add column if not exists emergency_contact_2_relationship text;
