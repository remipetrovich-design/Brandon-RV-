ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS event_key text,
  ADD COLUMN IF NOT EXISTS sender_mailbox_id text;

UPDATE public.email_templates
SET event_key = CASE template_key
  WHEN 'verify_account' THEN 'customer.registration_verification'
  WHEN 'forgot_password' THEN 'customer.password_reset_requested'
  WHEN 'password_changed' THEN 'customer.password_changed'
  WHEN 'welcome' THEN 'customer.account_activated'
  WHEN 'enquiry_received' THEN 'customer.enquiry_received'
  ELSE event_key
END
WHERE event_key IS NULL;

ALTER TABLE public.email_templates
  ALTER COLUMN event_key SET NOT NULL;

ALTER TABLE public.email_templates
  DROP CONSTRAINT IF EXISTS email_templates_template_key_check,
  DROP CONSTRAINT IF EXISTS email_templates_check,
  ADD CONSTRAINT email_templates_event_key_check CHECK (event_key IN (
    'customer.registration_verification',
    'customer.password_reset_requested',
    'customer.password_changed',
    'customer.account_activated',
    'customer.enquiry_received'
  )),
  ADD CONSTRAINT email_templates_security_event_check CHECK (
    event_key NOT IN (
      'customer.registration_verification',
      'customer.password_reset_requested',
      'customer.password_changed'
    ) OR (enabled = true AND is_security = true)
  );

CREATE INDEX IF NOT EXISTS email_templates_business_event_idx
  ON public.email_templates (business_id, event_key);

COMMENT ON COLUMN public.email_templates.event_key IS
  'Registered system event/function that automatically sends this template.';
COMMENT ON COLUMN public.email_templates.sender_mailbox_id IS
  'Mailbox ID assigned to the Brandon RV external system in OrbitFS Mail. NULL uses the system default sender.';
