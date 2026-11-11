-- Brandon RV canonical workforce roles, custom titles/scopes and individual permission grants.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS custom_title text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS team_name text;

CREATE TABLE IF NOT EXISTS public.user_permission_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(permission_key) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES public.users(id),
  reason text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id)
);
CREATE INDEX IF NOT EXISTS user_permission_grants_active_idx
  ON public.user_permission_grants(user_id,permission_key)
  WHERE revoked_at IS NULL;
ALTER TABLE public.user_permission_grants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_permission_grants FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_permission_grants TO service_role;

INSERT INTO public.user_roles(role_key,name,description,is_system) VALUES
 ('customer','Customer','Default permanent customer identity; not removable.',true),
 ('trial_apprentice','Trial Apprentice','Entry-level supervised workshop role.',true),
 ('apprentice','Apprentice','Apprentice workshop role.',true),
 ('senior_apprentice','Senior Apprentice','Advanced apprentice workshop role.',true),
 ('team_leader','Team Leader','Leads an assigned team and coordinates work.',true),
 ('supervisor','Supervisor','Supervises workshop operations and staff.',true),
 ('office_admin','Office Admin','Office administration and customer coordination.',true),
 ('office_supervisor','Office Supervisor','Supervises office operations.',true),
 ('office_manager','Office Manager','Manages office and administrative operations.',true),
 ('manager','Manager','Business operations management.',true),
 ('senior_manager','Senior Manager','Senior business operations management.',true),
 ('website_development_specialist','Website Development Specialist','Unrestricted access across the entire Brandon RV system.',true),
 ('ceo_founder','CEO / Founder','Unrestricted access across the entire Brandon RV system.',true)
ON CONFLICT (role_key) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,is_system=true;

-- Move legacy privileged accounts to the exact new executive role keys.
UPDATE public.users SET user_role='ceo_founder',updated_at=now() WHERE user_role='owner';
UPDATE public.users SET user_role='website_development_specialist',updated_at=now() WHERE user_role='website_developer';
UPDATE public.users SET user_role='senior_apprentice',updated_at=now() WHERE user_role='senior_worker';
UPDATE public.users SET user_role='office_admin',updated_at=now() WHERE user_role='office';

-- Remove legacy administrator aliases after users have been migrated.
DELETE FROM public.user_roles WHERE role_key IN ('owner','website_developer');

-- Seed a safe operational baseline for workshop workers.
WITH baseline(permission_key) AS (
 SELECT unnest(ARRAY['appointments.view','assets.view','documents.view','enquiries.view','jobs.complete','jobs.view','leave.view','onboarding.view','time.clock','vehicles.view'])
)
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT roles.role_key,baseline.permission_key
FROM unnest(ARRAY['trial_apprentice','apprentice','senior_apprentice']) AS roles(role_key)
CROSS JOIN baseline
JOIN public.permissions p ON p.permission_key=baseline.permission_key
ON CONFLICT DO NOTHING;

-- Team leaders receive the worker baseline plus coordination and read access.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT 'team_leader',p.permission_key FROM public.permissions p
WHERE p.permission_key IN ('appointments.manage','jobs.assign','jobs.manage','staff.view','time.approve','assets.view','reports.view')
ON CONFLICT DO NOTHING;

-- Supervisors can manage day-to-day workforce and workshop processes.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT 'supervisor',p.permission_key FROM public.permissions p
WHERE p.permission_key LIKE ANY(ARRAY['appointments.%','assets.%','documents.%','enquiries.%','jobs.%','leave.%','onboarding.%','staff.%','time.%','vehicles.%','reports.%'])
ON CONFLICT DO NOTHING;

-- Office roles cover customer intake, records, quotes and appointment administration.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT roles.role_key,p.permission_key
FROM unnest(ARRAY['office_admin','office_supervisor']) AS roles(role_key)
CROSS JOIN public.permissions p
WHERE p.permission_key LIKE ANY(ARRAY['customers.%','vehicles.%','enquiries.%','quotes.%','appointments.%','documents.%','invoices.view','payments.view','suppliers.view'])
ON CONFLICT DO NOTHING;

-- Office supervisors receive additional team oversight.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT 'office_supervisor',p.permission_key FROM public.permissions p
WHERE p.permission_key LIKE ANY(ARRAY['staff.view','leave.%','time.%','reports.%','invoices.manage','payments.manage'])
ON CONFLICT DO NOTHING;

-- Management roles receive broad operational access, while executive roles are
-- unrestricted in application authorization and cannot be permission-edited.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT roles.role_key,p.permission_key
FROM unnest(ARRAY['office_manager','manager','senior_manager']) AS roles(role_key)
CROSS JOIN public.permissions p
WHERE p.permission_key NOT IN ('roles.manage')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.users.custom_title IS 'Optional display title; never grants permissions by itself.';
COMMENT ON COLUMN public.users.department IS 'Optional organisational department for workforce filtering and reporting.';
COMMENT ON COLUMN public.users.team_name IS 'Optional team assignment for workforce filtering and reporting.';
COMMENT ON TABLE public.user_permission_grants IS 'Audited, optional per-user permission additions. Effective only while not revoked and not expired.';
