-- Support the filtered business dashboard, customer portal and workforce lookups.
-- These indexes reduce scans for the exact-count dashboard cards and recent-record lists.
CREATE INDEX IF NOT EXISTS enquiries_business_created_idx
  ON public.enquiries (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_user_quote_created_idx
  ON public.enquiries (user_id, created_at DESC)
  WHERE request_type = 'quote_request';
CREATE INDEX IF NOT EXISTS appointments_business_status_idx
  ON public.appointments (business_id, status);
CREATE INDEX IF NOT EXISTS appointments_user_created_idx
  ON public.appointments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_business_status_idx
  ON public.jobs (business_id, status);
CREATE INDEX IF NOT EXISTS quotes_business_status_created_idx
  ON public.quotes (business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS quotes_user_created_idx
  ON public.quotes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_business_created_idx
  ON public.invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS supplier_orders_business_status_idx
  ON public.supplier_orders (business_id, status);
CREATE INDEX IF NOT EXISTS job_assignments_business_staff_status_date_idx
  ON public.job_assignments (business_id, staff_id, status, assigned_at DESC);
CREATE INDEX IF NOT EXISTS job_work_entries_business_job_occurred_idx
  ON public.job_work_entries (business_id, job_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS staff_business_user_idx
  ON public.staff (business_id, user_id);
CREATE INDEX IF NOT EXISTS time_entries_staff_open_idx
  ON public.time_entries (staff_id)
  WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS users_business_role_idx
  ON public.users (business_id, user_role)
  WHERE user_role IS NOT NULL;
