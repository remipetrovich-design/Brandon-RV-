CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN ('account_verification','password_reset','welcome','enquiry_received')),
  subject text NOT NULL,
  body text NOT NULL,
  button_label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  is_security boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, template_key),
  CHECK (template_key NOT IN ('account_verification','password_reset') OR (enabled = true AND is_security = true))
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

INSERT INTO public.email_templates (business_id, template_key, subject, body, button_label, enabled, is_security)
SELECT b.id, t.template_key, t.subject, t.body, t.button_label, true, t.is_security
FROM public.businesses b
CROSS JOIN (VALUES
  ('account_verification','Verify your Brandon RV account',$body$Hi {name},

Confirm your email address to activate your Brandon RV customer account.

This link expires in 24 hours. If you did not create this account, ignore this email.$body$,'Verify email address',true),
  ('password_reset','Reset your Brandon RV password',$body$Hi {name},

Use the link below to reset your password. It expires in one hour.

If you did not request this, ignore this email.$body$,'Reset password',true),
  ('welcome','Your Brandon RV account is ready',$body$Hi {name},

Your email address has been verified and your Brandon RV customer account is now active.$body$,'Open customer account',false),
  ('enquiry_received','We received your Brandon RV enquiry',$body$Hi {name},

Thanks for contacting Brandon RV. Your enquiry has been received and will be reviewed. We will contact you to discuss the next steps.$body$,'Visit Brandon RV website',false)
) AS t(template_key,subject,body,button_label,is_security)
WHERE b.slug='brandon-rv'
ON CONFLICT (business_id, template_key) DO NOTHING;
