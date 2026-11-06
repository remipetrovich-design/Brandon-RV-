-- Unified customer identity with an optional employee addon and global user roles.
-- Legacy business_members/permission_groups remain for compatibility only;
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
    last_name = COALESCE(last_name, NULLIF(btrim(substr(btrim(full_name), length(split_part(btrim(full_name), ' ', 1)) + 1)), ''))
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

-- Ensure every customer identity is attached to the single Brandon RV workspace.
UPDATE public.users u SET business_id=b.id FROM public.businesses b WHERE b.slug='brandon-rv' AND u.business_id IS NULL;

-- Copy configured business role definitions into the global user-role catalogue.
-- Collapse duplicate normalized names before the upsert so one role key is
-- never targeted more than once in a single INSERT statement.
WITH candidates AS (
  SELECT trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')) AS role_key,
         pg.name, pg.description, pg.is_system,
         row_number() OVER (
           PARTITION BY trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g'))
           ORDER BY pg.is_system DESC, pg.name
         ) AS position
  FROM public.permission_groups pg
  JOIN public.businesses b ON b.id=pg.business_id
  WHERE b.slug='brandon-rv'
    AND trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')) NOT IN ('','customer')
)
INSERT INTO public.user_roles(role_key,name,description,is_system)
SELECT role_key,name,description,is_system
FROM candidates
WHERE position=1
ON CONFLICT (role_key) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  is_system=public.user_roles.is_system OR EXCLUDED.is_system;

-- Include legacy member role labels even if a matching permission group was not created.
INSERT INTO public.user_roles(role_key,name,description,is_system)
SELECT DISTINCT ON (role_key) role_key,initcap(bm.role),NULL,false
FROM public.business_members bm
JOIN public.businesses b ON b.id=bm.business_id
CROSS JOIN LATERAL (
  SELECT trim(both '_' from regexp_replace(lower(bm.role),'[^a-z0-9]+','_','g')) AS role_key
) normalized
WHERE b.slug='brandon-rv' AND bm.role IS NOT NULL AND normalized.role_key NOT IN ('','customer')
ORDER BY role_key,bm.role
ON CONFLICT (role_key) DO NOTHING;

-- The product has one global administrator label: Website Developer.
-- Convert the previous generic developer role before removing that alias.
INSERT INTO public.user_roles(role_key,name,description,is_system)
VALUES ('website_developer','Website Developer','Unrestricted website and operations access',true)
ON CONFLICT (role_key) DO UPDATE SET is_system=true;
-- Preserve the permissions attached to each named role.
INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT DISTINCT
  trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')),
  pgp.permission_key
FROM public.permission_groups pg
JOIN public.businesses b ON b.id=pg.business_id
JOIN public.permission_group_permissions pgp ON pgp.group_id=pg.id
WHERE b.slug='brandon-rv'
  AND trim(both '_' from regexp_replace(lower(pg.name),'[^a-z0-9]+','_','g')) NOT IN ('','customer')
ON CONFLICT DO NOTHING;

-- Do not merge member-specific permission groups into a shared role: that
-- would silently grant one employee's extra permissions to every user with
-- the same role. Their base role permissions are preserved; custom global
-- roles can be assigned deliberately after migration.

-- Translate existing employee access to the user's own role field.
UPDATE public.users u
SET user_role=NULLIF(NULLIF(trim(both '_' from regexp_replace(lower(bm.role),'[^a-z0-9]+','_','g')),''),'customer'),
    business_id=COALESCE(u.business_id,bm.business_id),
    employment_status=CASE WHEN bm.is_active THEN COALESCE(u.employment_status,'active') ELSE 'suspended' END,
    updated_at=now()
FROM public.business_members bm
JOIN public.businesses b ON b.id=bm.business_id
WHERE bm.user_id=u.id AND b.slug='brandon-rv' AND bm.role IS NOT NULL;

UPDATE public.users SET user_role='website_developer' WHERE user_role='developer';
DELETE FROM public.user_roles WHERE role_key='developer';

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

-- Normalize every legacy account into the single customer identity model.
UPDATE public.users SET primary_group='customer', account_type='customer', secondary_group=NULL WHERE primary_group IS DISTINCT FROM 'customer' OR account_type IS DISTINCT FROM 'customer' OR secondary_group IS NOT NULL;

ALTER TABLE public.users ALTER COLUMN account_type SET DEFAULT 'customer';
ALTER TABLE public.users ALTER COLUMN account_type SET NOT NULL;
ALTER TABLE public.users ALTER COLUMN primary_group SET DEFAULT 'customer';
ALTER TABLE public.users ALTER COLUMN primary_group SET NOT NULL;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_account_type_customer_check;
ALTER TABLE public.users ADD CONSTRAINT users_account_type_customer_check CHECK (account_type='customer');
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_secondary_group_null_check;
ALTER TABLE public.users ADD CONSTRAINT users_secondary_group_null_check CHECK (secondary_group IS NULL);

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
ALTER TABLE public.users ALTER COLUMN user_role SET DEFAULT NULL;
ALTER TABLE public.users ADD CONSTRAINT users_user_role_fkey
  FOREIGN KEY (user_role) REFERENCES public.user_roles(role_key) ON DELETE RESTRICT;

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

-- Update a role's permission set atomically; the API cannot leave a role
-- half-cleared if a permission insert fails.
CREATE OR REPLACE FUNCTION public.set_user_role_permissions(p_role_key text,p_permission_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public
AS $role_permissions$
BEGIN
  IF p_role_key IN ('owner','website_developer','customer') THEN
    RAISE EXCEPTION 'Reserved roles cannot have their permissions changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role_key=p_role_key) THEN
    RAISE EXCEPTION 'User role not found';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_permission_keys,ARRAY[]::text[])) AS requested(permission_key)
    LEFT JOIN public.permissions p ON p.permission_key=requested.permission_key
    WHERE p.permission_key IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more permissions are invalid';
  END IF;
  DELETE FROM public.user_role_permissions WHERE role_key=p_role_key;
  INSERT INTO public.user_role_permissions(role_key,permission_key)
  SELECT p_role_key,requested.permission_key
  FROM (
    SELECT DISTINCT permission_key
    FROM unnest(coalesce(p_permission_keys,ARRAY[]::text[])) AS keys(permission_key)
  ) requested;
END;
$role_permissions$;

REVOKE ALL ON FUNCTION public.set_user_role_permissions(text,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role_permissions(text,text[]) TO service_role;

-- The staff view is read-only. All employee changes go through the existing
-- customer user row and the employee addon API, never through a staff insert.
DROP TRIGGER IF EXISTS staff_view_write ON public.staff;
DROP FUNCTION IF EXISTS public.brandon_rv_staff_view_write();

-- Keep the customer compatibility view attached to the single user identity.
-- Removing a customer from the customer list deactivates the customer profile;
-- it never deletes the login or an employee addon.
CREATE OR REPLACE FUNCTION public.brandon_rv_customers_view_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_id uuid;
  v_full_name text;
  v_first_name text;
  v_last_name text;
BEGIN
  IF tg_op='DELETE' THEN
    UPDATE public.users
    SET customer_status='inactive',updated_at=now()
    WHERE id=old.id;
    RETURN old;
  ELSIF tg_op='INSERT' THEN
    v_id:=new.user_id;
    IF v_id IS NULL AND new.email IS NOT NULL THEN
      SELECT id INTO v_id FROM public.users
      WHERE email=lower(btrim(new.email)) LIMIT 1;
    END IF;
    v_full_name:=coalesce(nullif(btrim(new.full_name),''),'Customer');
    v_first_name:=coalesce(nullif(btrim(new.first_name),''),nullif(split_part(v_full_name,' ',1),''));
    v_last_name:=coalesce(nullif(btrim(new.last_name),''),nullif(btrim(substr(v_full_name,length(split_part(v_full_name,' ',1))+1)),''));
    IF v_id IS NOT NULL THEN
      UPDATE public.users SET
        business_id=coalesce(new.business_id,business_id),
        full_name=coalesce(nullif(btrim(new.full_name),''),full_name),
        first_name=coalesce(v_first_name,first_name),
        last_name=coalesce(v_last_name,last_name),
        date_of_birth=coalesce(new.date_of_birth,date_of_birth),
        email=coalesce(nullif(lower(btrim(new.email)),''),email),
        phone=coalesce(new.phone,phone),
        address=coalesce(new.address,address),suburb=coalesce(new.suburb,suburb),
        state=coalesce(new.state,state),postcode=coalesce(new.postcode,postcode),
        customer_internal_notes=coalesce(new.internal_notes,customer_internal_notes),
        customer_status=coalesce(new.status,customer_status,'active'),
        primary_group='customer',
        updated_at=now()
      WHERE id=v_id;
    ELSE
      IF new.email IS NULL OR btrim(new.email)='' THEN
        RAISE EXCEPTION 'A customer account requires an email address';
      END IF;
      INSERT INTO public.users(
        email,password_hash,full_name,first_name,last_name,date_of_birth,phone,
        account_type,status,business_id,primary_group,user_role,customer_status,
        address,suburb,state,postcode,customer_internal_notes
      ) VALUES (
        lower(btrim(new.email)),NULL,v_full_name,v_first_name,v_last_name,new.date_of_birth,new.phone,
        'customer','pending',new.business_id,'customer',NULL,coalesce(new.status,'active'),
        new.address,new.suburb,new.state,new.postcode,new.internal_notes
      ) RETURNING id INTO v_id;
    END IF;
    new.id:=v_id;
    new.user_id:=v_id;
    RETURN new;
  ELSE
    v_full_name:=coalesce(nullif(btrim(new.full_name),''),'Customer');
    v_first_name:=coalesce(nullif(btrim(new.first_name),''),nullif(split_part(v_full_name,' ',1),''));
    v_last_name:=coalesce(nullif(btrim(new.last_name),''),nullif(btrim(substr(v_full_name,length(split_part(v_full_name,' ',1))+1)),''));
    UPDATE public.users SET
      business_id=new.business_id,
      full_name=v_full_name,
      first_name=coalesce(v_first_name,first_name),
      last_name=coalesce(v_last_name,last_name),
      date_of_birth=new.date_of_birth,
      email=lower(btrim(new.email)),
      phone=new.phone,
      address=new.address,suburb=new.suburb,state=new.state,postcode=new.postcode,
      customer_internal_notes=new.internal_notes,
      customer_status=coalesce(new.status,'active'),
      primary_group='customer',
      updated_at=now()
    WHERE id=old.id;
    new.id:=old.id;
    new.user_id:=old.id;
    RETURN new;
  END IF;
END $$;

UPDATE public.permissions SET description='Manage employee details and user access' WHERE permission_key='staff.manage';

UPDATE public.user_invitations SET expires_at=now() WHERE account_type='staff' AND accepted_at IS NULL;

-- These tables are accessed only by the server-side service-role client.
-- New public tables are not automatically exposed through the Supabase Data API.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_permissions ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
REVOKE ALL ON public.user_roles,public.user_role_permissions FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_roles,public.user_role_permissions TO service_role;

CREATE INDEX IF NOT EXISTS users_business_user_role_idx ON public.users(business_id,user_role);
CREATE INDEX IF NOT EXISTS users_employee_addon_idx ON public.users(business_id,employment_status) WHERE employment_status IS NOT NULL;

COMMENT ON COLUMN public.users.secondary_group IS 'Deprecated compatibility field. Must remain NULL; employee access uses user_role and the employment addon.';
COMMENT ON COLUMN public.users.user_role IS 'Global role assigned to this user. NULL means customer-only access.';
COMMENT ON COLUMN public.users.employment_status IS 'NULL means no employee addon; non-NULL means employment details exist.';
COMMENT ON TABLE public.user_roles IS 'Global user roles. Roles belong to user accounts, never to a business membership.';
