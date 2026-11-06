INSERT INTO public.leave_types(business_id,name,paid,annual_entitlement_days)
SELECT id,'Annual leave',true,NULL FROM public.businesses WHERE slug='brandon-rv'
ON CONFLICT(business_id,name) DO NOTHING;
INSERT INTO public.leave_types(business_id,name,paid,annual_entitlement_days)
SELECT id,'Personal / carer''s leave',true,NULL FROM public.businesses WHERE slug='brandon-rv'
ON CONFLICT(business_id,name) DO NOTHING;
INSERT INTO public.leave_types(business_id,name,paid,annual_entitlement_days)
SELECT id,'Unpaid leave',false,NULL FROM public.businesses WHERE slug='brandon-rv'
ON CONFLICT(business_id,name) DO NOTHING;
