CREATE POLICY "Users can insert own credits log" ON public.credits_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);