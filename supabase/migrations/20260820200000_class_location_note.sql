-- One-to-ones don't always happen at a studio venue — they can be at a
-- family's house, a hired hall, or anywhere Amie agrees with the parent.
-- location_note holds that free-text address when venue_id is null.
alter table public.classes
  add column if not exists location_note text;

comment on column public.classes.location_note is
  'Free-text address for sessions not held at a saved venue (e.g. one-to-ones at a home).';
