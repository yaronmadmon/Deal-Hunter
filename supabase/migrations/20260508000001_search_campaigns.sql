-- Search campaigns: group properties from one search session under a named campaign
CREATE TABLE public.search_campaigns (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  filters        jsonb       DEFAULT '{}',
  property_count int         NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.search_campaigns (user_id, created_at DESC);

ALTER TABLE public.search_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own campaigns"
  ON public.search_campaigns FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Link each property back to the campaign that discovered it
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.search_campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS properties_campaign_id_idx ON public.properties (campaign_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.search_campaigns;
