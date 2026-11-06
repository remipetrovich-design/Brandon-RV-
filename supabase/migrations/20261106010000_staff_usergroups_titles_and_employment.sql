-- Brandon RV staff usergroups, employment types and lifecycle.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time';

-- Normalize legacy labels before enforcing the new status vocabulary.
UPDATE public.users SET employment_status=CASE employment_status
  WHEN 'on_leave' THEN 'leave'
  WHEN 'inactive' THEN 'suspended'
  ELSE employment_status
END
WHERE employment_status IN ('on_leave','inactive');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employment_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_employment_status_check
  CHECK (employment_status IN ('active','leave','suspended','terminated'));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE public.users ADD CONSTRAINT users_employment_type_check
  CHECK (employment_type IN ('casual','part_time','full_time'));

-- Customer remains the permanent primary account group. These are additive
-- business membership roles, not replacements for the customer's account group.
DO $$
DECLARE
  v_business_id uuid;
  v_group_id uuid;
  v_role text;
  v_permissions text[];
BEGIN
  SELECT id INTO v_business_id FROM public.businesses WHERE slug='brandon-rv' LIMIT 1;
  IF v_business_id IS NULL THEN RAISE EXCEPTION 'Brandon RV business record missing'; END IF;

  FOREACH v_role IN ARRAY ARRAY[
    'Apprentice','Worker','Senior Worker','Supervisor','Manager','Owner','Website Developer'
  ] LOOP
    INSERT INTO public.permission_groups(business_id,name,description,is_system)
    VALUES (
      v_business_id,
      v_role,
      CASE v_role
        WHEN 'Apprentice' THEN 'Trial staff access with limited permissions.'
        WHEN 'Worker' THEN 'Basic operational staff access.'
        WHEN 'Senior Worker' THEN 'Basic operational staff access for experienced workers.'
        WHEN 'Supervisor' THEN 'Elevated operational access and team oversight.'
        WHEN 'Manager' THEN 'Broad business management access.'
        WHEN 'Owner' THEN 'Complete business control.'
        ELSE 'Reserved technical access with full application permissions.'
      END,
      true
    )
    ON CONFLICT (business_id,name) DO UPDATE
      SET description=EXCLUDED.description, is_system=true;

    SELECT id INTO v_group_id FROM public.permission_groups
      WHERE business_id=v_business_id AND name=v_role LIMIT 1;

    v_permissions := CASE v_role
      WHEN 'Apprentice' THEN ARRAY['vehicles.view','appointments.view','jobs.view','documents.view']
      WHEN 'Worker' THEN ARRAY['vehicles.view','appointments.view','jobs.view','jobs.complete','documents.view']
      WHEN 'Senior Worker' THEN ARRAY['vehicles.view','appointments.view','jobs.view','jobs.complete','documents.view','time.view']
      WHEN 'Supervisor' THEN ARRAY['customers.view','vehicles.view','enquiries.view','quotes.view','appointments.view','appointments.manage','jobs.view','jobs.manage','jobs.assign','jobs.complete','time.view','time.manage','staff.view','documents.view','communications.manage']
      WHEN 'Manager' THEN ARRAY(SELECT permission_key FROM public.permissions WHERE permission_key NOT IN ('roles.manage','settings.manage','website.manage'))
      ELSE ARRAY(SELECT permission_key FROM public.permissions)
    END;

    IF v_role IN ('Owner','Website Developer') THEN
      INSERT INTO public.permission_group_permissions(group_id,permission_key)
      SELECT v_group_id,permission_key FROM public.permissions
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.permission_group_permissions(group_id,permission_key)
      SELECT v_group_id, unnest(v_permissions)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- Existing staff keep their current custom position title.

ALTER TABLE public.user_invitations
  ADD COLUMN IF NOT EXISTS job_title text,
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time';
ALTER TABLE public.user_invitations DROP CONSTRAINT IF EXISTS user_invitations_employment_type_check;
ALTER TABLE public.user_invitations ADD CONSTRAINT user_invitations_employment_type_check
  CHECK (employment_type IN ('casual','part_time','full_time'));

CREATE OR REPLACE VIEW public.staff WITH (security_invoker=true) AS
SELECT u.id,u.business_id,u.id AS user_id,u.employee_number,u.job_title,u.employment_status,
       u.start_date,u.emergency_contact_name,u.emergency_contact_phone,
       u.employee_internal_notes AS internal_notes,u.created_at,u.updated_at,
       u.full_name,u.email,u.phone,u.status AS account_status,u.employment_type
FROM public.users u
WHERE u.secondary_group='staff'
   OR EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.user_id=u.id AND bm.is_active=true);

CREATE OR REPLACE FUNCTION public.brandon_rv_staff_view_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 IF tg_op='DELETE' THEN
  UPDATE public.users SET secondary_group=NULL,employment_status='terminated',updated_at=now() WHERE id=old.id;
  UPDATE public.business_members SET is_active=false WHERE user_id=old.id AND business_id=old.business_id;
  RETURN old;
 ELSIF tg_op='INSERT' THEN
  v_id:=new.user_id;
  IF v_id IS NULL AND new.email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.users WHERE email=lower(btrim(new.email)) LIMIT 1;
  END IF;
  IF v_id IS NOT NULL THEN
   UPDATE public.users SET business_id=coalesce(new.business_id,business_id),primary_group='customer',
    secondary_group='staff',employee_number=new.employee_number,job_title=new.job_title,
    employment_status=coalesce(new.employment_status,'active'),
    employment_type=coalesce(new.employment_type,'full_time'),start_date=new.start_date,
    emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,
    employee_internal_notes=new.internal_notes,updated_at=now() WHERE id=v_id;
  ELSE
   IF new.email IS NULL OR btrim(new.email)='' THEN RAISE EXCEPTION 'A staff account requires an email address'; END IF;
   INSERT INTO public.users(email,password_hash,full_name,phone,account_type,status,business_id,
    primary_group,secondary_group,employee_number,job_title,employment_status,employment_type,start_date,
    emergency_contact_name,emergency_contact_phone,employee_internal_notes)
   VALUES(lower(btrim(new.email)),null,coalesce(nullif(new.full_name,''),'Staff member'),new.phone,
    'customer','pending',new.business_id,'customer','staff',new.employee_number,new.job_title,
    coalesce(new.employment_status,'active'),coalesce(new.employment_type,'full_time'),new.start_date,
    new.emergency_contact_name,new.emergency_contact_phone,new.internal_notes) RETURNING id INTO v_id;
  END IF;
  new.id:=v_id;new.user_id:=v_id;RETURN new;
 ELSE
  UPDATE public.users SET business_id=new.business_id,primary_group='customer',secondary_group='staff',
   employee_number=new.employee_number,job_title=new.job_title,employment_status=new.employment_status,
   employment_type=new.employment_type,start_date=new.start_date,
   emergency_contact_name=new.emergency_contact_name,emergency_contact_phone=new.emergency_contact_phone,
   employee_internal_notes=new.internal_notes,updated_at=now() WHERE id=old.id;
  new.id:=old.id;new.user_id:=old.id;RETURN new;
 END IF;
END $$;
