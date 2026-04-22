-- Deal Hunter: new tables alongside existing Gold Rush tables (additive only)

-- updated_at trigger function (reuse pattern from existing migrations)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── properties ───────────────────────────────────────────────────────────────
-- Core record per distressed property found via ATTOM. Mirrors the 'analyses' role.

CREATE TABLE IF NOT EXISTS public.properties (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address           text,
  city              text,
  state             text,
  zip               text,
  property_type     text,                          -- 'SFR'|'MFR'|'Condo'|'Land'|'Commercial'
  beds              int,
  baths             numeric,
  sqft              int,
  estimated_value   numeric,
  last_sale_price   numeric,
  last_sale_date    date,
  distress_types    text[]     DEFAULT '{}',       -- ['tax_lien','foreclosure','divorce','delinquency']
  distress_details  jsonb      DEFAULT '{}',       -- raw ATTOM event data
  equity_pct        numeric,
  deal_score        int,                           -- 0-100 AI score (null until scored)
  deal_verdict      text,                          -- 'Strong Deal'|'Investigate'|'Pass'
  report_data       jsonb      DEFAULT '{}',       -- full AI analysis + intelligence layer
  status            text       NOT NULL DEFAULT 'searching'
                               CHECK (status IN ('searching','scoring','complete','failed')),
  search_batch_id   uuid,                          -- groups properties from one search session
  search_filters    jsonb      DEFAULT '{}',       -- filters used (for admin replay)
  attom_id          text,                          -- ATTOM property identifier for dedup
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_attom UNIQUE (user_id, attom_id)
);

CREATE INDEX IF NOT EXISTS properties_user_id_idx       ON public.properties (user_id);
CREATE INDEX IF NOT EXISTS properties_batch_id_idx      ON public.properties (search_batch_id);
CREATE INDEX IF NOT EXISTS properties_status_idx        ON public.properties (status);
CREATE INDEX IF NOT EXISTS properties_updated_at_idx    ON public.properties (updated_at);

CREATE TRIGGER properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own properties"
  ON public.properties FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own properties"
  ON public.properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own properties"
  ON public.properties FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own properties"
  ON public.properties FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all properties"
  ON public.properties FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all properties"
  ON public.properties FOR UPDATE
  USING (public.is_admin(auth.uid()));

-- Enable Realtime (Processing page watches for status changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;


-- ─── pipeline_deals ───────────────────────────────────────────────────────────
-- CRM deal tracking. One row per property the user is actively working.

CREATE TABLE IF NOT EXISTS public.pipeline_deals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id  uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  stage        text        NOT NULL DEFAULT 'new'
                           CHECK (stage IN ('new','contacted','follow_up','negotiating','under_contract','won','dead')),
  priority     text        NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('high','medium','low')),
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_property_deal UNIQUE (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS pipeline_deals_user_id_idx    ON public.pipeline_deals (user_id);
CREATE INDEX IF NOT EXISTS pipeline_deals_stage_idx      ON public.pipeline_deals (stage);

CREATE TRIGGER pipeline_deals_updated_at
  BEFORE UPDATE ON public.pipeline_deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pipeline deals"
  ON public.pipeline_deals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pipeline deals"
  ON public.pipeline_deals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pipeline deals"
  ON public.pipeline_deals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pipeline deals"
  ON public.pipeline_deals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all pipeline deals"
  ON public.pipeline_deals FOR SELECT
  USING (public.is_admin(auth.uid()));


-- ─── owner_contacts ───────────────────────────────────────────────────────────
-- Skip trace results. One row per (property, user) pair.
-- UNIQUE constraint prevents double-charging credits.

CREATE TABLE IF NOT EXISTS public.owner_contacts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_name          text,
  phones              jsonb       DEFAULT '[]',   -- [{number, type, confidence}]
  emails              jsonb       DEFAULT '[]',   -- [{address, confidence}]
  mailing_address     jsonb       DEFAULT '{}',
  skip_trace_source   text        DEFAULT 'tracerfy',
  traced_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_owner_contact_per_user UNIQUE (property_id, user_id)
);

CREATE INDEX IF NOT EXISTS owner_contacts_property_id_idx ON public.owner_contacts (property_id);
CREATE INDEX IF NOT EXISTS owner_contacts_user_id_idx     ON public.owner_contacts (user_id);

ALTER TABLE public.owner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own owner contacts"
  ON public.owner_contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own owner contacts"
  ON public.owner_contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all owner contacts"
  ON public.owner_contacts FOR SELECT
  USING (public.is_admin(auth.uid()));


-- ─── contact_log ──────────────────────────────────────────────────────────────
-- Immutable contact history per property. No UPDATE policy — log entries are permanent.

CREATE TABLE IF NOT EXISTS public.contact_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_type  text        NOT NULL
                            CHECK (contact_type IN ('call','email','sms','visit','note')),
  outcome       text        CHECK (outcome IN ('no_answer','left_voicemail','spoke','interested','not_interested')),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_log_property_id_idx ON public.contact_log (property_id);
CREATE INDEX IF NOT EXISTS contact_log_user_id_idx     ON public.contact_log (user_id);
CREATE INDEX IF NOT EXISTS contact_log_created_at_idx  ON public.contact_log (created_at DESC);

ALTER TABLE public.contact_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own contact log"
  ON public.contact_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own contact log"
  ON public.contact_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all contact logs"
  ON public.contact_log FOR SELECT
  USING (public.is_admin(auth.uid()));


-- ─── saved_searches ───────────────────────────────────────────────────────────
-- Saved filter sets. Also used as the basis for email deal alerts.

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  filters     jsonb       NOT NULL DEFAULT '{}',
  -- filters shape: { location, distress_types[], price_min, price_max, property_types[], equity_min }
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_searches_user_id_idx ON public.saved_searches (user_id);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved searches"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved searches"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved searches"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved searches"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);
