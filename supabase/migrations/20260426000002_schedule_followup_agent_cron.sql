CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule('run-followup-agent-bihourly')
WHERE EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'run-followup-agent-bihourly'
);

SELECT cron.schedule(
  'run-followup-agent-bihourly',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnileremxagzmlieykgm.supabase.co/functions/v1/run-followup-agent',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuaWxlcmVteGFnem1saWV5a2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjE0ODcsImV4cCI6MjA4OTg5NzQ4N30.pUnuVgv0rT2KDBkSCA0OBC5Cmufk0Gt_sybAoMWYYIE", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
