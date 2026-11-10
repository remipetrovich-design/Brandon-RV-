-- Customer identity stays in the customer group; verification is represented by account status.
-- Keep legacy pending/disabled values available for existing staff and compatibility flows.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_status_check
  CHECK (status IN ('unverified','active','suspended','banned','pending','disabled'));

-- Registrations created before this lifecycle change used pending for email verification.
UPDATE public.users
SET status = 'unverified'
WHERE primary_group = 'customer'
  AND status = 'pending'
  AND email_verified_at IS NULL;

COMMENT ON COLUMN public.users.status IS
  'Account access status: unverified, active, suspended, or banned. Legacy pending/disabled values remain supported for compatibility.';
