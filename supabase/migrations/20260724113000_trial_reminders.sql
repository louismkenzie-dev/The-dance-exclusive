-- Day-before trial reminder emails.
--
-- 1. Seed the studio-editable note included word-for-word in the reminder
--    (edited by admins under Admin → Settings → Company → Trial Reminder
--    Email; the daily-reminders edge function reads it at send time).
insert into public.app_settings (key, value, description)
values (
  'trial_reminder_message',
  'We can''t wait to meet you! Please arrive 10 minutes early so we can get you settled, wear comfy clothes you can move in, and bring a bottle of water. Any questions at all, just reply to this email.',
  'Included word-for-word in the day-before trial reminder email. Edit freely — plain text, line breaks kept.'
)
on conflict (key) do nothing;

-- 2. Run the daily-reminders edge function every morning (08:00 UTC ≈ 9am
--    UK summer time). The bearer is the public anon key — the same pattern
--    as the memberships-maintenance job.
select cron.schedule(
  'daily-reminders-morning',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://suwaetnsszlpaaykhpif.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d2FldG5zc3pscGFheWtocGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjY0MzAsImV4cCI6MjA5ODE0MjQzMH0.sWvinnUvaFwz7aF974sWc35-d9Rg_KQCYkRcNM0hQTk'
    ),
    body := '{}'::jsonb
  );
  $$
);
