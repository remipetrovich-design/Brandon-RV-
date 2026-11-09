-- Unified enquiry intake: one record per submission, category views, stage history and staff assignment.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS internal_notes text;

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_request_type_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_request_type_check
  CHECK (request_type IN ('public_enquiry','general_enquiry','customer_enquiry','quote_request'));

ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_stage_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_stage_check
  CHECK (stage IN ('new','contacted','awaiting_information','assessment_required','quote_in_progress','quote_sent','awaiting_approval','approved','declined','converted','closed'));

-- Existing contact-form submissions are reclassified in place, not copied.
UPDATE public.enquiries
SET request_type='public_enquiry', stage=CASE status
  WHEN 'reviewing' THEN 'contacted'
  WHEN 'quoted' THEN 'quote_sent'
  WHEN 'accepted' THEN 'approved'
  WHEN 'declined' THEN 'declined'
  WHEN 'converted' THEN 'converted'
  WHEN 'closed' THEN 'closed'
  ELSE 'new'
END
WHERE request_type='general_enquiry' AND source='contact_page';

CREATE TABLE IF NOT EXISTS public.enquiry_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  assigned_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS enquiry_assignments_one_active_uidx
  ON public.enquiry_assignments(enquiry_id,staff_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS enquiry_assignments_staff_active_idx
  ON public.enquiry_assignments(staff_id,assigned_at DESC) WHERE unassigned_at IS NULL;

CREATE TABLE IF NOT EXISTS public.enquiry_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  enquiry_id uuid NOT NULL REFERENCES public.enquiries(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  note text,
  changed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS enquiry_stage_history_enquiry_idx
  ON public.enquiry_stage_history(enquiry_id,created_at DESC);

INSERT INTO public.enquiry_stage_history(business_id,enquiry_id,from_stage,to_stage,changed_by,note)
SELECT e.business_id,e.id,NULL,e.stage,NULL,'Initial stage recorded during unified intake migration.'
FROM public.enquiries e
WHERE NOT EXISTS (SELECT 1 FROM public.enquiry_stage_history h WHERE h.enquiry_id=e.id);

ALTER TABLE public.enquiry_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enquiry_stage_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.enquiry_assignments,public.enquiry_stage_history FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.enquiry_assignments,public.enquiry_stage_history TO service_role;
