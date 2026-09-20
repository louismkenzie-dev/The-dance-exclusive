-- A class anyone has EVER been on cannot be deleted.
--
-- The 14 September guard blocked deletion while places were live. Tonight it
-- let a class through anyway, because of the order things happened in:
--
--   Amie cancelled the Elmstead Primary School classes and refunded everyone.
--   That set every booking to 'cancelled'. With no live places left, the
--   guard was satisfied, the class was deleted, and bookings.class_id
--   cascades — so the cancelled rows went too, and with them every parent's
--   name, email and phone. She then had nobody to tell, which is the one
--   thing she still had to do: "I can't find any of their contacts now."
--
-- Cancelling a class is exactly when you most need the list of who was on it.
-- So the test is no longer "is anyone on this class" but "has anyone ever
-- been", cancelled and refunded included. A class with history is retired
-- with is_active = false, which keeps the record and takes it off sale.
create or replace function public.prevent_delete_class_with_places()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_bookings int;
  live_memberships int;
  past_bookings int;
  past_memberships int;
begin
  select count(*) filter (where status <> 'cancelled'), count(*)
    into live_bookings, past_bookings
    from public.bookings where class_id = old.id;
  select count(*) filter (where status <> 'cancelled'), count(*)
    into live_memberships, past_memberships
    from public.memberships where class_id = old.id;

  if live_bookings > 0 or live_memberships > 0 then
    raise exception
      'Cannot delete the class "%" — % booking(s) and % membership(s) are still on it. Make it inactive instead, or move everyone off it first.',
      old.name, live_bookings, live_memberships
      using errcode = 'restrict_violation';
  end if;

  -- Nobody is on it now, but people were. Deleting would take the only record
  -- of who they are, which is what the studio needs in order to tell them.
  if past_bookings > 0 or past_memberships > 0 then
    raise exception
      'Cannot delete the class "%" — % booking(s) and % membership(s) were on it and have been cancelled. Deleting would erase who they were, and you need that to contact them. Make it inactive instead.',
      old.name, past_bookings, past_memberships
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists classes_no_delete_with_places on public.classes;

create trigger classes_no_delete_with_places
  before delete on public.classes
  for each row
  execute function public.prevent_delete_class_with_places();
