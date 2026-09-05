-- The register's "payment failed" flag only looked at memberships.status =
-- 'past_due', which is set by the nightly maintenance job. That job runs at
-- 06:10 UTC and Stripe raises the invoices at 07:00, so a payment that fails
-- on the 5th is not reflected in the status column until 06:10 the NEXT day —
-- the register showed those families as paid up for the whole of billing day.
--
-- Also treat a live membership whose payment date has passed with nothing
-- taken as unpaid. That is true the moment a renewal fails, whatever the
-- status column says. 'paused' is excluded: collection is deliberately voided
-- across a family's free month, so no payment is expected.
CREATE OR REPLACE FUNCTION public.get_unpaid_membership_attendees(_class_id uuid)
 RETURNS TABLE(student_id uuid, user_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.student_id, m.user_id
  from public.memberships m
  where m.class_id = _class_id
    and (
      m.status = 'past_due'
      or (
        m.status in ('active', 'cancel_scheduled')
        and m.current_period_end is not null
        and m.current_period_end < now()
      )
    )
    and (
      public.has_role(auth.uid(), 'admin'::app_role)
      or public.get_staff_id_for_user(auth.uid()) is not null
    );
$function$;
