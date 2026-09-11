-- An invite can be spent.
--
-- class_invites has only ever allowed two states, 'pending' and 'cancelled'.
-- When the code that marks an invite 'accepted' once the family books went
-- live, Postgres rejected every one of those writes — quietly, because that
-- tidying-up is deliberately written never to throw (a booking that has been
-- paid for must not come undone because the bookkeeping after it failed).
-- The visible effect was that a place the studio saved stayed saved after it
-- had been taken, so the same £9 trial could be bought twice.
--
-- The third state is the one the code has been trying to write all along.
alter table public.class_invites
  drop constraint if exists class_invites_status_check;

alter table public.class_invites
  add constraint class_invites_status_check
  check (status in ('pending', 'cancelled', 'accepted'));

-- Everything that was already taken but couldn't be marked so. Eight live
-- invites had a confirmed booking against them and were still sitting as
-- "pending"; without this they'd keep unlocking a plan the family had
-- already bought.
update public.class_invites ci
   set status = 'accepted'
 where ci.status = 'pending'
   and exists (
     select 1 from public.bookings b
      where b.class_id = ci.class_id
        and b.parent_id = ci.parent_id
        and b.student_id = ci.student_id
        and b.status = 'confirmed'
   );
