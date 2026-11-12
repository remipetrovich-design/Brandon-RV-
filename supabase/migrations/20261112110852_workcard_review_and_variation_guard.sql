ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS workcard_review_status text NOT NULL DEFAULT 'legacy_approved',
  ADD COLUMN IF NOT EXISTS workcard_review_note text,
  ADD COLUMN IF NOT EXISTS workcard_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS workcard_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_workcard_review_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_workcard_review_status_check
  CHECK (workcard_review_status IN ('pending_review','approved','changes_requested','legacy_approved'));
UPDATE public.jobs SET workcard_review_status='legacy_approved' WHERE workcard_review_status IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_one_open_variation_per_job_uidx
  ON public.quotes(job_id) WHERE quote_kind='variation' AND status IN ('draft','sent');