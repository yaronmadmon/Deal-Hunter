-- Enable pg_net extension for HTTP calls from cron
create extension if not exists pg_net;

-- Schedule live-feed-refresh to run every hour on the hour.
-- verify_jwt = false for this function (see supabase/config.toml), so anon key is sufficient.
--
-- NOTE: Replace <ANON_KEY> with your project's anon key (safe to embed — it's public).
-- Find it at: Supabase Dashboard → Settings → API → Project API keys → anon/public
--
-- Alternatively, set this up via Supabase Dashboard → Database → Cron Jobs (no SQL needed).

select cron.schedule(
  'live-feed-hourly-refresh',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://vnileremxagzmlieykgm.supabase.co/functions/v1/live-feed-refresh',
    headers := '{"Authorization": "Bearer <ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{"section": "all"}'::jsonb
  );
  $$
);
