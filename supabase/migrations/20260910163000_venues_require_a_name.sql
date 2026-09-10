-- A venue with no name is a half-finished record, not a venue.
--
-- Fourteen of them accumulated between 6 August and 10 September. They came
-- from the Add Venue form: its tabs unmount the panel that isn't showing, so
-- pressing "Create Venue" from Costs or Location left the browser with no
-- name field to validate and it saved a shell — no name, no address, no
-- classes. Three were also flagged publicly visible, which put blank cards on
-- the public venues page.
--
-- The form now checks the essentials itself before saving. This is the
-- backstop underneath it: whatever any client does, the database will not
-- accept a nameless venue.
--
-- The fourteen were deleted first, after confirming none was referenced by a
-- class, camp, party package, show, contact, facility or photo. (The classes
-- and party_packages foreign keys are ON DELETE SET NULL, so a referenced
-- venue would have silently detached its classes rather than refusing.)
--
-- `name` is already NOT NULL, so this only has to rule out the empty string
-- and whitespace.

alter table public.venues
  add constraint venues_name_not_blank
  check (btrim(name) <> '');

comment on constraint venues_name_not_blank on public.venues is
  'A venue must be named. Blank names came from the Add Venue form saving before its required fields were on screen.';
