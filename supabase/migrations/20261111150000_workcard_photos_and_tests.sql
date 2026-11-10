-- Workcard evidence: non-billable tests/checks and private photo/document attachments.
-- Guest Jobcards can progress through final invoice and payment without a customer account.
ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.payments ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.job_work_entries DROP CONSTRAINT IF EXISTS job_work_entries_entry_type_check;
ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_entry_type_check
  CHECK (entry_type IN ('labour','parts','note','test'));

CREATE TABLE IF NOT EXISTS public.job_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  customer_visible boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_attachments_job_visible_created_idx
  ON public.job_attachments (business_id, job_id, customer_visible, created_at DESC);
ALTER TABLE public.job_attachments ENABLE ROW LEVEL SECURITY;
