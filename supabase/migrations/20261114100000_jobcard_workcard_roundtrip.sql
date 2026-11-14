-- Complete the Jobcard -> Workcard -> Jobcard lifecycle.
-- Quote lines become planned Workcard entries; actual use and ordering are recorded separately.
ALTER TABLE public.job_work_entries
  ADD COLUMN IF NOT EXISTS quantity_ordered numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_received numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_returned numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS part_order_status text NOT NULL DEFAULT 'not_ordered',
  ADD COLUMN IF NOT EXISTS supplier_order_reference text,
  ADD COLUMN IF NOT EXISTS ordered_at timestamptz,
  ADD COLUMN IF NOT EXISTS expected_at timestamptz,
  ADD COLUMN IF NOT EXISTS received_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_ordered_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_ordered_nonnegative CHECK (quantity_ordered >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_received_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_received_nonnegative CHECK (quantity_received >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_returned_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_returned_nonnegative CHECK (quantity_returned >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_returned_lte_received') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_returned_lte_received CHECK (quantity_returned <= quantity_received);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_received_lte_ordered') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_received_lte_ordered CHECK (quantity_received <= quantity_ordered);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_part_order_status_check') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_part_order_status_check CHECK (part_order_status IN ('not_ordered','ordered','part_received','received','not_required','cancelled'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS job_work_entries_part_order_status_idx
  ON public.job_work_entries (business_id, job_id, part_order_status)
  WHERE entry_type = 'parts';

COMMENT ON COLUMN public.job_work_entries.quantity_ordered IS 'Quantity ordered from the supplier for this planned part line.';
COMMENT ON COLUMN public.job_work_entries.quantity_received IS 'Quantity physically received against the supplier order.';
COMMENT ON COLUMN public.job_work_entries.quantity_returned IS 'Quantity returned to the supplier after receipt; distinct from quantity used.';
COMMENT ON COLUMN public.job_work_entries.part_order_status IS 'Supplier ordering and receiving state; separate from actual quantity used.';
