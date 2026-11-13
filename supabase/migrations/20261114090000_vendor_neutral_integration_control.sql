-- Brandon RV vendor-neutral external API control plane.
-- External API access is disabled by default. Credentials are stored as hashes only.
CREATE TABLE IF NOT EXISTS public.integration_control_settings (
  business_id uuid PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  api_enabled boolean NOT NULL DEFAULT false,
  pause_reason text,
  require_approval_for_sensitive_actions boolean NOT NULL DEFAULT true,
  default_rate_limit_per_minute integer NOT NULL DEFAULT 60 CHECK (default_rate_limit_per_minute BETWEEN 1 AND 600),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description text,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  allowed_ip_addresses text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer CHECK (rate_limit_per_minute BETWEEN 1 AND 600),
  expires_at timestamptz,
  last_used_at timestamptz,
  last_used_ip_hash text,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_credentials_business_created_idx ON public.integration_credentials(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS integration_credentials_active_idx ON public.integration_credentials(token_prefix) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.integration_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  credential_id uuid REFERENCES public.integration_credentials(id) ON DELETE SET NULL,
  integration_name text NOT NULL,
  request_id text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  required_scope text,
  action text,
  entity_type text,
  entity_id uuid,
  status_code integer NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('success','denied','error','pending')),
  ip_hash text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS integration_audit_business_created_idx ON public.integration_audit_logs(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS integration_audit_credential_created_idx ON public.integration_audit_logs(credential_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.integration_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid NOT NULL REFERENCES public.integration_credentials(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL DEFAULT 'in_progress' CHECK (state IN ('in_progress','succeeded','failed')),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  UNIQUE(credential_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS integration_idempotency_expiry_idx ON public.integration_idempotency(expires_at);

ALTER TABLE public.integration_control_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_idempotency ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON public.integration_control_settings,public.integration_credentials,public.integration_audit_logs,public.integration_idempotency FROM anon,authenticated;
GRANT ALL PRIVILEGES ON public.integration_control_settings,public.integration_credentials,public.integration_audit_logs,public.integration_idempotency TO service_role;

COMMENT ON TABLE public.integration_control_settings IS 'Business-wide kill switch and policy controls for the vendor-neutral external API.';
COMMENT ON TABLE public.integration_credentials IS 'Per-integration credentials. Only token hashes are persisted; plaintext secrets are shown once.';
COMMENT ON TABLE public.integration_audit_logs IS 'Security and action audit trail for all external API requests.';
COMMENT ON TABLE public.integration_idempotency IS 'Atomic retry protection for state-changing external API requests.';
