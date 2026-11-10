-- A declined quote closes and archives its originating customer request.
ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS enquiries_business_archived_created_idx
  ON public.enquiries (business_id, archived_at, created_at DESC);
