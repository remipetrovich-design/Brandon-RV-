-- Unified customer identity with an optional employee addon and global user roles.
-- Legacy business_members/permission_groups are retained as migration history only;
-- runtime authorization moves to users.user_role and user_role_permissions.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS pay_rate numeric(12,2),
  ADD COLUMN IF NOT EXISTS pay_frequency text,
  ADD COLUMN IF NOT EXISTS payroll_reference text,
  ADD COLUMN IF NOT EXISTS payroll_notes text,
  ADD COLUMN IF NOT EXISTS end_date date;

UPDATE public.users
SET first_name = COALESCE(first_name, NULLIF(split_part(btrim(full_name), ' ', 1), '')),
    last_name = COALESCE(last_name, NULLIF(btrim(regexp_replace(btrim(full_name), '^\\S+\\s*', '')), ''))
WHERE first_name IS NULL OR last_name IS NULL;

CREATE TABLE IF NOT EXISTS public.user_roles (
  role_key text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_role_permissions (
  role_key text NOT NULL REFERENCES public.user_roles(role_key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(permission_key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

-- Copy configured business role definitions into the global user-role catalogue.
INSERT INTO public.user_roles(role_key,name,description,is_system)
SELECT DISTINCT
  trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')),
  pg.name, pg.description, pg.is_system
FROM public.permission_groups pg
JOIN public.businesses b ON b.id=pg.business_id
WHERE b.slug='brandon-rv'
  AND trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')) <> ''
ON CONFLICT (role_key) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  is_system=public.user_roles.is_system OR EXCLUDED.is_system;

-- Preserve permissions assigned directly to each legacy role.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT DISTINCT
  trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')),
  pgp.permission_key
FROM public.permission_groups pg
JOIN public.businesses b ON b.id=pg.business_id
JOIN public.permission_group_permissions pgp ON pgp.group_id=pg.id
WHERE b.slug='brandon-rv'
ON CONFLICT DO NOTHING;

-- Preserve any extra permission groups assigned to a member by folding them
-- into that member's effective global role.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT DISTINCT
  trim(both '_' from regexp_replace(lower(bm.role),'[^a-z0-9]+','_','g')),
  pgp.permission_key
FROM public.business_members bm
JOIN public.businesses b ON b.id=bm.business_id
JOIN public.permission_groups role_group
  ON role_group.business_id=bm.business_id AND lower(role_group.name)=lower(bm.role)
JOIN public.member_permission_groups mpg ON mpg.member_id=bm.id
JOIN public.permission_group_permissions pgp ON pgp.group_id=mpg.group_id
WHERE b.slug='brandon-rv'
ON CONFLICT DO NOTHING;

-- Translate existing employee access to the user's own role field.
UPDATE public.users u
SET user_role=trim(both '_' from regexp_replace(lower(bm.role),'[^a-z0-9]+','_','g')),
    business_id=COALESCE(u.business_id,bm.business_id),
    employment_status=CASE WHEN bm.is_active THEN COALESCE(u.employment_status,'active') ELSE 'suspended' END,
    updated_at=now()
FROM public.business_members bm
JOIN public.businesses b ON b.id=bm.business_id
WHERE bm.user_id=u.id AND b.slug='brandon-rv';

-- Preserve employee records even where an old membership was inactive or had no role.
UPDATE public.users
SET employment_status=COALESCE(employment_status,'active'),
    employment_type=COALESCE(employment_type,'full_time')
WHERE secondary_group='staff' OR user_role IS NOT NULL;

UPDATE public.users
SET employment_status=NULL, employment_type=NULL, employee_number=NULL,
    job_title=NULL, start_date=NULL, end_date=NULL, pay_rate=NULL,
    pay_frequency=NULL, payroll_reference=NULL, payroll_notes=NULL,
    emergency_contact_name=NULL, emergency_contact_phone=NULL,
    employee_internal_notes=NULL
WHERE secondary_group IS DISTINCT FROM 'staff'
  AND user_role IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.user_id=users.id);

ALTER TABLE public.users ALTER COLUMN employment_status DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN employment_status DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN employment_type DROP DEFAULT;
ALTER TABLE public.users ALTER COLUMN employment_type DROP NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employment_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_employment_status_check
  CHECK (employment_status IS NULL OR employment_status IN ('active','leave','suspended','terminated'));
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_employment_type_check
  CHECK (employment_type IS NULL OR employment_type IN ('casual','part_time','full_time'));
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pay_frequency_check;
ALTER TABLE public.users ADD CONSTRAINT users_pay_frequency_check
  CHECK (pay_frequency IS NULL OR pay_frequency IN ('hourly','weekly','fortnightly','monthly','annually'));
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_pay_rate_check;
ALTER TABLE public.users ADD CONSTRAINT users_pay_rate_check CHECK (pay_rate IS NULL OR pay_rate >= 0);

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_role_fkey;
ALTER TABLE public.users ADD CONSTRAINT users_user_role_fkey
  FOREIGN KEY (user_role) REFERENCES public.user_roles(role_key) ON DELETE SET NULL;

-- Customer remains the permanent account identity. The customer view exposes
-- account/profile data and remains keyed by the same users.id.
CREATE OR REPLACE VIEW public.customers WITH (security_invoker=true) AS
SELECT id,business_id,id AS user_id,full_name,email,phone,address,suburb,state,postcode,
       customer_internal_notes AS internal_notes,customer_status AS status,created_at,updated_at,
       first_name,last_name,date_of_birth,user_role
FROM public.users WHERE primary_group='customer';

CREATE OR REPLACE VIEW public.staff WITH (security_invoker=true) AS
SELECT u.id,u.business_id,u.id AS user_id,u.employee_number,u.job_title,
       u.employment_status,u.start_date,u.emergency_contact_name,u.emergency_contact_phone,
       u.employee_internal_notes AS internal_notes,u.created_at,u.updated_at,
       u.full_name,u.email,u.phone,u.status AS account_status,u.employment_type,
       u.end_date,u.pay_rate,u.pay_frequency,u.payroll_reference,u.payroll_notes,u.user_role
FROM public.users u
WHERE u.employment_status IS NOT NULL;

UPDATE public.user_invitations SET expires_at=now() WHERE account_type='staff' AND accepted_at IS NULL;

COMMENT ON COLUMN public.users.user_role IS 'Global role assigned to this user. NULL means customer-only access.';
COMMENT ON COLUMN public.users.employment_status IS 'NULL means no employee addon; non-NULL means employment details exist.';
COMMENT ON TABLE public.user_roles IS 'Global user roles. Roles belong to user accounts, never to a business membership.';
