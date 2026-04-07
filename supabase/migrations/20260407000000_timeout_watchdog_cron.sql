-- Schedule timeout-watchdog to run every 10 minutes.
-- Marks stuck analyses (pending/fetching/analyzing for >5 min) as failed,
-- preventing orphaned rows from accumulating in the analyses table.
--
-- Requires pg_net extension (already enabled for live-feed cron).

SELECT cron.schedule(
  'timeout-watchdog-every-10min',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vnileremxagzmlieykgm.supabase.co/functions/v1/timeout-watchdog',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
