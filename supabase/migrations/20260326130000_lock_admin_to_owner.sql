-- Lock admin access to owner account only
-- All other entries in admin_emails are removed

DELETE FROM public.admin_emails;

INSERT INTO public.admin_emails (email)
VALUES ('yaronmadmon@gmail.com')
ON CONFLICT (email) DO NOTHING;
