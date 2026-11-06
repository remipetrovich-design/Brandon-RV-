-- Brandon RV staff usergroups, employment types and lifecycle.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'full_time';

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

-- Existing staff keep their current custom position title. Existing employment
-- statuses are normalized to the new lifecycle labels.
UPDATE public.users SET employment_status=CASE employment_status
  WHEN 'on_leave' THEN 'leave'
  WHEN 'inactive' THEN 'suspended'
  ELSE employment_status
END
WHERE employment_status IN ('on_leave','inactive');
