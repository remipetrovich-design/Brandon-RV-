DO $$
DECLARE
  v_staff_roles text[] := ARRAY['apprentice','senior_worker','office','supervisor','manager'];
  v_staff_permissions text[] := ARRAY[
    'appointments.view','assets.view','documents.view','enquiries.view',
    'jobs.complete','jobs.view','leave.view','onboarding.view','time.clock','vehicles.view'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE user_role = ANY(v_staff_roles)) THEN
    RAISE EXCEPTION 'Staff roles currently have assigned users; refusing to change their permissions without a user-by-user review.';
  END IF;
  DELETE FROM public.user_role_permissions WHERE role_key = ANY(v_staff_roles);
  INSERT INTO public.user_role_permissions(role_key, permission_key)
  SELECT role_key, permission_key
  FROM unnest(v_staff_roles) AS role_key
  CROSS JOIN unnest(v_staff_permissions) AS permission_key;
END
$$;
