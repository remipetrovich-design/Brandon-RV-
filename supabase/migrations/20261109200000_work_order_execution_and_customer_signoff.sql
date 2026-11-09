-- Work Order execution, customer sign-off and final job record.
-- Preserve all existing jobs, assignments, invoices and payment history.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS work_summary text,
  ADD COLUMN IF NOT EXISTS customer_approval_status text NOT NULL DEFAULT 'not_ready',
  ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_approval_note text,
  ADD COLUMN IF NOT EXISTS final_report_created_at timestamptz;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_approval_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_approval_status_check
  CHECK (customer_approval_status IN ('not_ready','pending','approved','changes_requested'));

ALTER TABLE public.invoices ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.payments ALTER COLUMN customer_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.job_work_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  staff_id uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('labour','parts','note')),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  line_total numeric(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  customer_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_work_entries_job_created_idx
  ON public.job_work_entries(job_id, occurred_at, created_at);
ALTER TABLE public.job_work_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_work_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_work_entries TO service_role;
