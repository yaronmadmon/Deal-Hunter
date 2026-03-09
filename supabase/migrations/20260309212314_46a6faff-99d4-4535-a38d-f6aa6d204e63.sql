
CREATE TABLE public.x_api_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'search',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX idx_x_api_cache_key ON public.x_api_cache (cache_key, action);
CREATE INDEX idx_x_api_cache_expires ON public.x_api_cache (expires_at);

ALTER TABLE public.x_api_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on x_api_cache"
ON public.x_api_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can read cache"
ON public.x_api_cache
FOR SELECT
TO authenticated
USING (true);
