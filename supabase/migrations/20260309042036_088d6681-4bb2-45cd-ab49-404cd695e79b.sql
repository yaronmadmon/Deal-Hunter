-- Create trigger on auth.users for profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create atomic credit deduction function
CREATE OR REPLACE FUNCTION public.deduct_credit(analysis_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_credits int;
BEGIN
  -- Lock the row for update to prevent race conditions
  SELECT credits INTO current_credits
  FROM public.profiles
  WHERE id = auth.uid()
  FOR UPDATE;

  IF current_credits >= 1 THEN
    UPDATE public.profiles
    SET credits = credits - 1
    WHERE id = auth.uid();
    
    -- Insert into credits log
    INSERT INTO public.credits_log (user_id, amount, reason, analysis_id)
    VALUES (auth.uid(), -1, 'Analysis generation', deduct_credit.analysis_id);
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;