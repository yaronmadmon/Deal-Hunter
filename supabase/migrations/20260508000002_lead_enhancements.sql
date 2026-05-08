-- Tags on pipeline deals for flexible lead categorization
ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- SMS thread inbox tracking: unread count, last inbound timestamp, pending AI draft
ALTER TABLE public.sms_threads
  ADD COLUMN IF NOT EXISTS unread_count    int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_inbound_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_draft        text;

CREATE INDEX IF NOT EXISTS sms_threads_unread_idx
  ON public.sms_threads (user_id, last_inbound_at DESC)
  WHERE unread_count > 0;
