CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  template_key text NOT NULL CHECK (template_key IN ('verify_account','forgot_password','password_changed','welcome','enquiry_received')),
  subject text NOT NULL,
  title text NOT NULL,
  intro text NOT NULL DEFAULT '',
  body text NOT NULL,
  button_label text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  is_security boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, template_key),
  CHECK (template_key NOT IN ('verify_account','forgot_password','password_changed') OR (enabled = true AND is_security = true))
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_templates FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO service_role;

INSERT INTO public.email_templates (business_id,template_key,subject,title,intro,body,button_label,enabled,is_security)
SELECT b.id,t.template_key,t.subject,t.title,t.intro,t.body,t.button_label,true,t.is_security
FROM public.businesses b
CROSS JOIN (VALUES
 ('verify_account','Verify your {site_name} account','Verify your email address','Hi {firstname},','Please confirm your email address to finish setting up your Brandon RV account. This helps us make sure important quotes, booking updates and job information reach the right person.','Verify email address',true),
 ('forgot_password','Reset your {site_name} password','Password reset requested','Hi {firstname},','We received a request to reset the password for your Brandon RV account. Use the secure button below to choose a new password.','Reset password',true),
 ('password_changed','Your {site_name} password was changed','Your password has been changed','Hi {firstname},','The password for your Brandon RV account was successfully changed.','',true),
 ('welcome','Welcome to {site_name}, {firstname}','Welcome to Brandon RV','Hi {firstname},','Your Brandon RV customer account is ready. Your customer portal keeps your enquiries, vehicle details, quotes, bookings, invoices and job updates together.','Open customer portal',false),
 ('enquiry_received','We''ve received your Brandon RV enquiry','Thanks for getting in touch','Hi {firstname},','Your enquiry has been received. The Brandon RV team will review the information and get back to you about the next step.','Visit Brandon RV website',false)
) AS t(template_key,subject,title,intro,body,button_label,is_security)
WHERE b.slug='brandon-rv'
ON CONFLICT (business_id,template_key) DO NOTHING;
