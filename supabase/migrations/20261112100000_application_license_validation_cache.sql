alter table public.application_license
 add column if not exists cached_validation jsonb;
