-- Expand employee engagement types without changing customer account identity.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_employment_type_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_employment_type_check
  CHECK (employment_type IN ('casual','part_time','full_time','contractor','temporary'));

COMMENT ON COLUMN public.users.employment_type IS
  'Employment arrangement for business staff access. This does not change the user primary customer account.';
