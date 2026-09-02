-- Which classes a pass may be spent on. Both optional and independent; an
-- empty/null list means "no restriction on this axis", so existing passes
-- keep working against any adult class exactly as before.
--   applies_to_durations: class lengths in minutes, e.g. {60} for the
--     60-minute (£10) classes — a £40 4-class pass is 4 x £10, so allowing it
--     on a 75-minute (£12) class would undercharge.
--   applies_to_class_ids: specific classes, when a pass is for one course.
alter table public.class_pass_types
  add column if not exists applies_to_durations integer[],
  add column if not exists applies_to_class_ids uuid[];
