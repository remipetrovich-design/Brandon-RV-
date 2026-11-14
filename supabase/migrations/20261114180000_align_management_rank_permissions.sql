-- Align legacy workforce rank aliases with the canonical management permission model.
-- Management ranks receive operational permissions but never role-definition authority.
INSERT INTO public.user_roles(role_key,name,description,is_system) VALUES
 ('administrator','Administrator','Business administration and operational management.',true),
 ('general_manager','General Manager','Senior operational leadership across the business.',true)
ON CONFLICT (role_key) DO UPDATE
SET name=EXCLUDED.name,description=EXCLUDED.description,is_system=true;

INSERT INTO public.user_role_permissions(role_key,permission_key)
SELECT roles.role_key,p.permission_key
FROM unnest(ARRAY['administrator','general_manager']) AS roles(role_key)
CROSS JOIN public.permissions p
WHERE p.permission_key <> 'roles.manage'
ON CONFLICT DO NOTHING;
