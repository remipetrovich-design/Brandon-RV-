-- Service publication is gated by an explicit business approval decision.
-- Existing services default to assessment required; no service is newly authorised.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'assessment_required';

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_approval_status_check;
ALTER TABLE public.services ADD CONSTRAINT services_approval_status_check
  CHECK (approval_status IN ('approved_for_launch','conditional','assessment_required','deferred','not_offered'));

-- Do not expose a service merely because an old publication flag was set.
UPDATE public.services
SET is_published = false
WHERE approval_status <> 'approved_for_launch';
