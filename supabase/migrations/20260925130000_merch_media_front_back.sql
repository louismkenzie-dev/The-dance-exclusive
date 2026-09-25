-- Mark which merchandise photo is the reverse of the garment, so a shop tile can flip from the
-- front print to the back on hover.
--
-- `is_primary` already means "the tile image", which is the front, so only the back is new.
-- Default false = every existing photo stays a front, and the client falls back to "the second
-- photo by sort order" until an admin flags one. Nothing changes visually on apply.
alter table public.merchandise_media
  add column if not exists is_back boolean not null default false;

-- At most one back per product. Partial index so the other photos are unconstrained.
create unique index if not exists merchandise_media_one_back_per_item
  on public.merchandise_media (item_id)
  where is_back;

-- A photo cannot be both the tile image and the reverse.
alter table public.merchandise_media
  drop constraint if exists merchandise_media_back_is_not_primary;
alter table public.merchandise_media
  add constraint merchandise_media_back_is_not_primary
  check (not (is_back and is_primary));

comment on column public.merchandise_media.is_back is
  'True for the reverse-of-garment photo shown when a shop tile is hovered or tapped.';
