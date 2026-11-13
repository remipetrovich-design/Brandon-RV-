-- Link service catalogue items to quote and Workcard records while keeping actual costing separate from estimates.
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL;

ALTER TABLE public.job_work_entries
  ADD COLUMN IF NOT EXISTS service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quantity_required numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity_required >= 0),
  ADD COLUMN IF NOT EXISTS quantity_used numeric(12,2) NOT NULL DEFAULT 0 CHECK (quantity_used >= 0),
  ADD COLUMN IF NOT EXISTS cost_unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_unit_price >= 0),
  ADD COLUMN IF NOT EXISTS part_number text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS invoiceable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS quote_items_service_id_idx ON public.quote_items(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS job_work_entries_job_invoiceable_idx ON public.job_work_entries(business_id,job_id,invoiceable);

COMMENT ON COLUMN public.job_work_entries.unit_price IS 'Actual customer charge per used unit, excluding tax. Not copied from the estimate quote.';
COMMENT ON COLUMN public.job_work_entries.cost_unit_price IS 'Actual business cost per used unit, excluding tax.';
COMMENT ON COLUMN public.job_work_entries.quantity_required IS 'Quantity identified as required during diagnosis or planning.';
COMMENT ON COLUMN public.job_work_entries.quantity_used IS 'Actual quantity used or actual labour hours recorded.';
COMMENT ON COLUMN public.job_work_entries.invoiceable IS 'Only approved, completed actual-work entries marked invoiceable are included in the final invoice.';


-- These columns are introduced by the preceding production migration. Add
-- their validation constraints explicitly because ADD COLUMN IF NOT EXISTS
-- does not add constraints when the columns already exist.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_required_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_required_nonnegative CHECK (quantity_required >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_quantity_used_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_quantity_used_nonnegative CHECK (quantity_used >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_work_entries'::regclass AND conname='job_work_entries_cost_unit_price_nonnegative') THEN
    ALTER TABLE public.job_work_entries ADD CONSTRAINT job_work_entries_cost_unit_price_nonnegative CHECK (cost_unit_price >= 0);
  END IF;
END;
$$;
