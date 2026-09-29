-- Run payments-sync every night, so the reports are never more than a day behind the bank.
--
-- 02:30 UTC is after midnight in London whether it is GMT or BST, and nothing else is running.
--
-- The call is built from the existing daily-reminders job — same project URL, same bearer — with
-- only the function name swapped. That keeps the key out of this file entirely instead of pasting
-- it into a third migration. If that job is ever renamed or removed, this warns and schedules
-- nothing rather than scheduling something broken; "Sync now" on the Reports page still works.

do $$
declare
  _cmd text;
begin
  select replace(command, '/functions/v1/daily-reminders', '/functions/v1/payments-sync')
    into _cmd
    from cron.job
   where jobname = 'daily-reminders-morning';

  if _cmd is null or _cmd not like '%/functions/v1/payments-sync%' then
    raise warning 'daily-reminders-morning not found — payments-sync has NOT been scheduled. Schedule it by hand.';
    return;
  end if;

  perform cron.unschedule('payments-sync-nightly')
    where exists (select 1 from cron.job where jobname = 'payments-sync-nightly');

  perform cron.schedule('payments-sync-nightly', '30 2 * * *', _cmd);
end $$;
