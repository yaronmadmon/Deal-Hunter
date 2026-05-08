ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS monitor_run_time time,
  ADD COLUMN IF NOT EXISTS monitor_timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS saved_search_id uuid REFERENCES public.saved_searches(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_saved_search_id_idx
  ON public.notifications(saved_search_id, created_at DESC);
