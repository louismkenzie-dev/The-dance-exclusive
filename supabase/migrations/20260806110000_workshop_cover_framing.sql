-- Merch-style framing for workshop (type-of-class) cover art:
--   cover_zoom  > 1 zooms into the focal point (cover_position);
--   cover_fit  'contain' shows the whole image letterboxed (for square
--              logo artwork that a cropped card would cut off).
alter table public.workshops
  add column if not exists cover_zoom numeric,
  add column if not exists cover_fit text not null default 'cover';

alter table public.workshops
  add constraint workshops_cover_fit_check check (cover_fit in ('cover', 'contain'));
