-- Reserved platform developer role with full Brandon RV application access.
ALTER TABLE public.business_members DROP CONSTRAINT IF EXISTS business_members_role_check;
ALTER TABLE public.business_members
  ADD CONSTRAINT business_members_role_check
  CHECK (role IN ('owner','administrator','manager','technician','office','accounts','developer'));

DO $$
DECLARE
  business_id uuid;
  developer_group_id uuid;
BEGIN
  SELECT id INTO business_id FROM public.businesses WHERE slug='brandon-rv' LIMIT 1;
  IF business_id IS NULL THEN
    RAISE EXCEPTION 'Brandon RV business record missing';
  END IF;

  INSERT INTO public.permission_groups(business_id,name,description,is_system)
  VALUES (business_id,'Developer','Reserved technical role with full application access.',true)
  ON CONFLICT (business_id,name) DO NOTHING;

  SELECT id INTO developer_group_id
  FROM public.permission_groups
  WHERE business_id=business_id AND lower(name)='developer'
  LIMIT 1;

  INSERT INTO public.permission_group_permissions(group_id,permission_key)
  SELECT developer_group_id,permission_key FROM public.permissions
  ON CONFLICT DO NOTHING;
END $$;
