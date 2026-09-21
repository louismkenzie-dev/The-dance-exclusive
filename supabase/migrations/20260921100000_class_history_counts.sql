-- How many people have EVER been on each class, cancelled included.
--
-- The classes page greys Delete out for any class with history, because the
-- database refuses the delete anyway (see the 20 September guard) and a
-- button that only ever produces an error is a trap. Cancel is the action
-- for a class with people on it, and it stays lit.
create or replace function public.get_class_history(_class_ids uuid[])
returns table (class_id uuid, places bigint)
language sql
security definer
set search_path = public
stable
as $$
  select t.class_id, sum(t.n)::bigint as places
  from (
    select b.class_id, count(*) as n
      from public.bookings b
     where b.class_id = any(_class_ids)
     group by b.class_id
    union all
    select m.class_id, count(*) as n
      from public.memberships m
     where m.class_id = any(_class_ids)
     group by m.class_id
  ) t
  group by t.class_id
$$;

revoke execute on function public.get_class_history(uuid[]) from anon;
grant execute on function public.get_class_history(uuid[]) to authenticated;
