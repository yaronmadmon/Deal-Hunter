-- Deal Hunter: add property_id to credits_log + skip trace credit deduction RPC

-- Add nullable property_id column to credits_log
-- The existing analysis_id FK is kept intact; property_id is a parallel field for skip trace deductions
ALTER TABLE public.credits_log
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id);

-- ─── deduct_credit_for_property ───────────────────────────────────────────────
-- Atomically deducts 1 skip trace credit from the calling user's profile.
-- Returns true on success, false if user has insufficient credits.
-- Called from the skip-trace edge function (server-side, service role context).

CREATE OR REPLACE FUNCTION public.deduct_credit_for_property(p_property_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_credits integer;
BEGIN
  -- Lock the profile row to prevent concurrent double-deductions
  SELECT credits
    INTO v_current_credits
    FROM public.profiles
   WHERE id = auth.uid()
     FOR UPDATE;

  IF v_current_credits IS NULL OR v_current_credits <= 0 THEN
    RETURN false;
  END IF;

  -- Deduct 1 credit
  UPDATE public.profiles
     SET credits = credits - 1,
         updated_at = now()
   WHERE id = auth.uid();

  -- Audit trail
  INSERT INTO public.credits_log (user_id, amount, reason, analysis_id, property_id)
  VALUES (auth.uid(), -1, 'skip_trace', NULL, p_property_id);

  RETURN true;
END;
$$;

-- Grant execute to authenticated users (called via RPC from frontend or edge function)
GRANT EXECUTE ON FUNCTION public.deduct_credit_for_property(uuid) TO authenticated;
