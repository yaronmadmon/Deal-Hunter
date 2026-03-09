-- Create admin_emails table for whitelist
CREATE TABLE public.admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on admin_emails
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_emails ae
    JOIN auth.users u ON u.email = ae.email
    WHERE u.id = _user_id
  )
$$;

-- Admin can read admin_emails table
CREATE POLICY "Admins can read admin_emails"
ON public.admin_emails FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admin can manage admin_emails
CREATE POLICY "Admins can manage admin_emails"
ON public.admin_emails FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies to profiles table
CREATE POLICY "Admins can read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies to analyses table
CREATE POLICY "Admins can read all analyses"
ON public.analyses FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update all analyses"
ON public.analyses FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete analyses"
ON public.analyses FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add admin policies to credits_log table
CREATE POLICY "Admins can read all credits_log"
ON public.credits_log FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert credits_log"
ON public.credits_log FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies to live_feed_snapshots
CREATE POLICY "Admins can manage live_feed"
ON public.live_feed_snapshots FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies to watchlist
CREATE POLICY "Admins can read all watchlist"
ON public.watchlist FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Add admin policies to notifications - allow admin to insert
CREATE POLICY "Admins can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can read all notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));