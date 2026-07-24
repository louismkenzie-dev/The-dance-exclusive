-- Staff need to see WHO on a register hasn't paid (past-due membership) so
-- non-payers can be caught at the door — without exposing amounts or any
-- other billing data. Security-definer RPC: returns only the attendee ids
-- of past-due memberships for one class, and only to staff or admins.
create or replace function public.get_unpaid_membership_attendees(_class_id uuid)
returns table (student_id uuid, user_id uuid)
language sql
security definer
set search_path = public
as $$
  select m.student_id, m.user_id
  from public.memberships m
  where m.class_id = _class_id
    and m.status = 'past_due'
    and (
      public.has_role(auth.uid(), 'admin'::app_role)
      or public.get_staff_id_for_user(auth.uid()) is not null
    );
$$;

grant execute on function public.get_unpaid_membership_attendees(uuid) to authenticated;
