-- What a coach needs to know at the door: which dancers in front of them have merchandise
-- waiting, and what to hand over.
--
-- Security-definer RPCs rather than table policies, so coaches see exactly these columns for
-- exactly the class they are taking, and nothing else about anybody's order. Staff get no policy
-- on the merch tables at all; this is their only way in.
--
-- The staff test is get_staff_id_for_user, matching get_unpaid_membership_attendees — the same
-- predicate that decides who may see a register in the first place. It is NOT
-- has_role(..., 'staff'): a user_roles row and a staff record are different things.

-- Which dancers on this class's register have something ready, and how many pieces.
create or replace function public.get_merch_collection_attendees(_class_id uuid)
returns table (student_id uuid, item_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.student_id, count(*)::bigint as item_count
  from public.merch_order_items i
  where i.status = 'ready'
    and i.student_id is not null
    and exists (
      select 1
      from public.bookings b
      where b.student_id = i.student_id
        and b.class_id = _class_id
        and b.status = 'confirmed'
    )
    and (
      public.has_role(auth.uid(), 'admin')
      or public.get_staff_id_for_user(auth.uid()) is not null
    )
  group by i.student_id;
$$;

grant execute on function public.get_merch_collection_attendees(uuid) to authenticated;

-- What to actually hand this dancer. Names the garment and the size, and the personalisation so
-- the coach can check the right one is going to the right child — nothing about money.
create or replace function public.get_merch_collection_items(_student_id uuid)
returns table (
  item_id uuid,
  product_name text,
  size text,
  quantity integer,
  personalisation text,
  order_number bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id as item_id,
    i.product_name,
    i.size,
    i.quantity,
    (
      select string_agg(p.placement || ': ' || p.text, ', ' order by p.placement)
      from public.merch_order_item_personalisations p
      where p.order_item_id = i.id
    ) as personalisation,
    o.order_number
  from public.merch_order_items i
  join public.merch_orders o on o.id = i.order_id
  where i.student_id = _student_id
    and i.status = 'ready'
    and (
      public.has_role(auth.uid(), 'admin')
      or public.get_staff_id_for_user(auth.uid()) is not null
    )
  order by i.product_name, i.size;
$$;

grant execute on function public.get_merch_collection_items(uuid) to authenticated;

-- When is each of these dancers next in a class? Drives "hand over at: Tue 30 Sep, Junior Street"
-- on Amie's orders screen, and the ready-to-collect email.
--
-- Admin only: it exposes where a child will be and when, across every class, which is far more
-- than a coach needs and more than anyone else should have in one call.
create or replace function public.get_students_next_session(_student_ids uuid[])
returns table (
  student_id uuid,
  session_id uuid,
  session_date date,
  start_time time,
  class_name text,
  venue_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (b.student_id)
    b.student_id,
    s.id as session_id,
    s.session_date,
    s.start_time,
    c.name as class_name,
    v.name as venue_name
  from public.bookings b
  join public.class_sessions s on s.class_id = b.class_id
  join public.classes c on c.id = b.class_id
  left join public.venues v on v.id = c.venue_id
  where b.student_id = any(_student_ids)
    and b.status = 'confirmed'
    and s.session_date >= current_date
    -- class_sessions has no is_cancelled flag; status holds 'scheduled' or 'cancelled'.
    and s.status <> 'cancelled'
    -- The SQL twin of bookingCountsOnDate in src/lib/registerRules.ts.
    --
    -- There is no session_dates column on bookings. A single-session booking records its date in
    -- the NOTES, as "session YYYY-MM-DD", and the register parses it with a regex. That is
    -- fragile, but this RPC has to agree with what the register actually shows, so it reads the
    -- same field the same way. No marker means the booking counts on every session of the class.
    and (
      substring(b.notes from 'session (\d{4}-\d{2}-\d{2})') is null
      or substring(b.notes from 'session (\d{4}-\d{2}-\d{2})') = s.session_date::text
    )
    and public.has_role(auth.uid(), 'admin')
  order by b.student_id, s.session_date, s.start_time;
$$;

grant execute on function public.get_students_next_session(uuid[]) to authenticated;
