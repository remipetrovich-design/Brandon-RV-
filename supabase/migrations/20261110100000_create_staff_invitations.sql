-- Staff invitations attach employee access to an existing or newly registered customer account.
-- Registration uses the same invitation token to preserve the customer-first account flow.

CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  role_key text NOT NULL REFERENCES public.user_roles(role_key) ON DELETE RESTRICT,
  job_title text NOT NULL,
  employment_type text NOT NULL DEFAULT 'full_time'
    CHECK (employment_type IN ('casual','part_time','full_time')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  invited_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_invitations_email_normalized CHECK (email = lower(btrim(email)))
);

CREATE INDEX IF NOT EXISTS staff_invitations_business_pending_idx
  ON public.staff_invitations(business_id, created_at DESC)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS staff_invitations_email_idx
  ON public.staff_invitations(business_id, email);

ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_invitations FROM anon, authenticated;
GRANT ALL ON public.staff_invitations TO service_role;
