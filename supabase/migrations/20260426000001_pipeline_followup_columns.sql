ALTER TABLE public.pipeline_deals
  ADD COLUMN IF NOT EXISTS follow_up_at     timestamptz,
  ADD COLUMN IF NOT EXISTS next_action      text
    CHECK (next_action IN ('call','text','email','letter','pause')),
  ADD COLUMN IF NOT EXISTS next_step_brief  text,
  ADD COLUMN IF NOT EXISTS urgency_flag     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_status text NOT NULL DEFAULT 'none'
    CHECK (follow_up_status IN ('none','pending','overdue','completed'));

CREATE INDEX IF NOT EXISTS pipeline_deals_follow_up_at_idx
  ON public.pipeline_deals (user_id, follow_up_at ASC)
  WHERE follow_up_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS pipeline_deals_follow_up_status_idx
  ON public.pipeline_deals (follow_up_status, stage)
  WHERE follow_up_status IN ('pending','overdue');

ALTER PUBLICATION supabase_realtime ADD TABLE public.pipeline_deals;
