-- A class that people are on cannot be deleted.
--
-- bookings.class_id cascades on delete and memberships.class_id sets null, so
-- deleting one class row silently destroys every place on it and quietly
-- detaches live Stripe subscriptions from the thing they are paying for. The
-- admin delete button ran with no check at all: three paying families lost
-- their places on the Chatham Tuesday class this way and nobody was told —
-- not the studio, not the parents, who kept being charged.
--
-- Retiring a class is what `is_active = false` is for. Deleting is only ever
-- right for a class nobody has joined.
create or replace function public.prevent_delete_class_with_places()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  live_bookings int;
  live_memberships int;
begin
  select count(*) into live_bookings
    from public.bookings where class_id = old.id and status <> 'cancelled';
  select count(*) into live_memberships
    from public.memberships where class_id = old.id and status <> 'cancelled';

  if live_bookings > 0 or live_memberships > 0 then
    raise exception
      'Cannot delete the class "%" — % booking(s) and % membership(s) are still on it. Make it inactive instead, or move everyone off it first.',
      old.name, live_bookings, live_memberships
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
