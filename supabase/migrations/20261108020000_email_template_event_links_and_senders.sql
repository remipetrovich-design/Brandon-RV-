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
    'customer.enquiry_received',
    'staff.invitation_sent'
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

INSERT INTO public.email_templates (business_id,template_key,event_key,subject,title,intro,body,button_label,enabled,is_security)
SELECT b.id,'staff_invitation','staff.invitation_sent',
  '{inviter_name} invited you to join {site_name}',
  'You''re invited to join the Brandon RV team',
  'Hi {firstname},',
  '{inviter_name} has invited you to join Brandon RV as {staff_role}. Position: {job_title}. Follow the invitation link to sign in to your existing customer account or create a customer account with this email address, then accept your staff access.',
  'Accept staff invitation',true,false
FROM public.businesses b
WHERE b.slug='brandon-rv'
ON CONFLICT (business_id,template_key) DO NOTHING;
