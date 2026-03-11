
-- 1. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text DEFAULT 'free',
  status text DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- 2. Analytics events table
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  user_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access analytics" ON public.analytics_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins can read analytics" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can insert analytics" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. User delete own analyses policy
CREATE POLICY "Users can delete own analyses" ON public.analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Add suspended column to profiles
ALTER TABLE public.profiles ADD COLUMN suspended boolean DEFAULT false;

-- 5. Rate limiting helper function
CREATE OR REPLACE FUNCTION public.analyses_count_last_hour(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.analyses
  WHERE user_id = _user_id
    AND created_at > now() - interval '1 hour'
$$;
