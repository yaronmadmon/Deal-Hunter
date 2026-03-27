-- Fix pg_cron job: replace <ANON_KEY> placeholder with actual anon key
-- verify_jwt = false for live-feed-refresh, so anon key is sufficient

SELECT cron.unschedule('live-feed-hourly-refresh');

SELECT cron.schedule(
  'live-feed-hourly-refresh',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnileremxagzmlieykgm.supabase.co/functions/v1/live-feed-refresh',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZuaWxlcmVteGFnem1saWV5a2dtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMjE0ODcsImV4cCI6MjA4OTg5NzQ4N30.pUnuVgv0rT2KDBkSCA0OBC5Cmufk0Gt_sybAoMWYYIE", "Content-Type": "application/json"}'::jsonb,
    body := '{"section": "all"}'::jsonb
  );
  $$
);
