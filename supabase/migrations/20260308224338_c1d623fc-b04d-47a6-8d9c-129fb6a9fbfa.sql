
CREATE TABLE public.live_feed_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  section_name TEXT NOT NULL,
  data_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_feed_section ON public.live_feed_snapshots(section_name, created_at DESC);

ALTER TABLE public.live_feed_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read live feed"
  ON public.live_feed_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert live feed"
  ON public.live_feed_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can delete live feed"
  ON public.live_feed_snapshots
  FOR DELETE
  TO service_role
  USING (true);
