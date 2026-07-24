-- Editable framing for class-advert cover photos. Admin sets a focal point
-- on the workshop cover image; every public rendering (class cards, camp
-- cards, bookings list, admin thumbnails) applies it as CSS object-position
-- so the chosen part of the photo stays in frame at any aspect ratio —
-- fixing "looks great in the back end, cropped wrong on mobile".
alter table public.workshops
  add column if not exists cover_position text;
