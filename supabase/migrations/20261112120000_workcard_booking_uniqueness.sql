-- A quote and a confirmed appointment can each produce only one Workcard.
-- Existing data was checked for duplicates before adding these safeguards.
CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_workcard_per_quote_idx
  ON public.jobs (business_id, quote_id)
  WHERE quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_workcard_per_appointment_idx
  ON public.jobs (business_id, appointment_id)
  WHERE appointment_id IS NOT NULL;
