-- Run membership maintenance daily at 06:10 UTC (idempotent; safe to re-run).
-- The bearer token is the project's PUBLISHABLE anon key (already shipped in
-- the frontend bundle) — it only satisfies the function's JWT gate.
DO $$ BEGIN
  PERFORM cron.unschedule('memberships-maintenance-daily');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'memberships-maintenance-daily',
  '10 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://suwaetnsszlpaaykhpif.supabase.co/functions/v1/memberships-maintenance',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d2FldG5zc3pscGFheWtocGlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1NjY0MzAsImV4cCI6MjA5ODE0MjQzMH0.sWvinnUvaFwz7aF974sWc35-d9Rg_KQCYkRcNM0hQTk'
    ),
    body := '{}'::jsonb
  );
  $$
);
