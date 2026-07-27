-- Per-photo framing for merchandise media: focal point (CSS object-position,
-- e.g. "50% 25%") and zoom (1 = fit as before). Null = legacy "contain"
-- rendering, so existing product photos look unchanged until the admin
-- frames them.
alter table public.merchandise_media
  add column if not exists position text,
  add column if not exists zoom numeric;
