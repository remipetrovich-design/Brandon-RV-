INSERT INTO public.permissions(permission_key,description) VALUES ('time.clock','Clock in and out for own shifts') ON CONFLICT(permission_key) DO NOTHING;
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT role_key,'time.clock' FROM public.user_roles
WHERE role_key IN ('owner','website_developer','administrator','manager','supervisor','technician','worker','senior_worker','apprentice','office')
ON CONFLICT DO NOTHING;
