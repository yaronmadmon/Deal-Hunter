-- One thread per homeowner phone per investor
CREATE TABLE public.sms_threads (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id      uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  homeowner_phone  text        NOT NULL,
  ai_enabled       boolean     NOT NULL DEFAULT true,
  status           text        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active','paused','ended')),
  last_message_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, homeowner_phone)
);

-- Every individual SMS, both directions
CREATE TABLE public.sms_messages (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id         uuid        NOT NULL REFERENCES public.sms_threads(id) ON DELETE CASCADE,
  direction         text        NOT NULL CHECK (direction IN ('outbound','inbound')),
  body              text        NOT NULL,
  telnyx_message_id text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Meetings booked via AI conversation
CREATE TABLE public.meetings (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id      uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  thread_id        uuid        REFERENCES public.sms_threads(id),
  homeowner_phone  text        NOT NULL,
  homeowner_name   text,
  scheduled_at_raw text,
  scheduled_at     timestamptz,
  notes            text,
  status           text        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending','confirmed','cancelled')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON public.sms_threads (user_id, last_message_at DESC);
CREATE INDEX ON public.sms_threads (homeowner_phone);
CREATE INDEX ON public.sms_messages (thread_id, created_at ASC);
CREATE INDEX ON public.meetings (user_id, created_at DESC);

ALTER TABLE public.sms_threads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns sms_threads"  ON public.sms_threads  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "user owns sms_messages" ON public.sms_messages FOR ALL
  USING (thread_id IN (SELECT id FROM public.sms_threads WHERE user_id = auth.uid()));
CREATE POLICY "user owns meetings"     ON public.meetings      FOR ALL USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.sms_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
