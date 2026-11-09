-- Extend the existing enquiry, messaging, quote and appointment records.
-- No existing customer, enquiry, quote, appointment or job records are replaced.

ALTER TABLE public.enquiries
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'quote_request',
  ADD COLUMN IF NOT EXISTS request_number text,
  ADD COLUMN IF NOT EXISTS vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_access_token_hash text,
  ADD COLUMN IF NOT EXISTS guest_access_expires_at timestamptz;

UPDATE public.enquiries
SET request_number = 'BRV-' || to_char(created_at AT TIME ZONE 'UTC', 'YYMMDD') || '-' || upper(substr(replace(id::text, '-', ''), 1, 6))
WHERE request_number IS NULL;

ALTER TABLE public.enquiries ALTER COLUMN request_number SET NOT NULL;
ALTER TABLE public.enquiries DROP CONSTRAINT IF EXISTS enquiries_request_type_check;
ALTER TABLE public.enquiries ADD CONSTRAINT enquiries_request_type_check
  CHECK (request_type IN ('general_enquiry', 'customer_enquiry', 'quote_request'));

CREATE UNIQUE INDEX IF NOT EXISTS enquiries_business_request_number_uidx ON public.enquiries (business_id, request_number);
CREATE INDEX IF NOT EXISTS enquiries_request_type_created_idx ON public.enquiries (business_id, request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS enquiries_guest_access_idx ON public.enquiries (guest_access_token_hash) WHERE guest_access_token_hash IS NOT NULL;

-- Guest quote requests remain first-class records without forcing account registration.
ALTER TABLE public.quotes
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS supersedes_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS response_at timestamptz,
  ADD COLUMN IF NOT EXISTS response_note text;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_revision_number_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_revision_number_check CHECK (revision_number >= 1);
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'converted'::text, 'superseded'::text]));

CREATE INDEX IF NOT EXISTS quotes_enquiry_revision_idx ON public.quotes (enquiry_id, revision_number DESC) WHERE enquiry_id IS NOT NULL;

-- customer_messages already supports enquiry and quote threads. Allow a guest
-- participant to use the same thread without creating a login or fake user.
ALTER TABLE public.customer_messages
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;
CREATE INDEX IF NOT EXISTS customer_messages_enquiry_created_idx ON public.customer_messages (enquiry_id, created_at) WHERE enquiry_id IS NOT NULL;

-- A requested time is not a booking. The staff confirmation action records
-- who confirmed the agreed date, time and location.
ALTER TABLE public.appointments
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_confirmed_booking_per_quote_uidx ON public.appointments (quote_id) WHERE quote_id IS NOT NULL AND status = 'confirmed';

-- The existing jobs table becomes the Work Order record in the next workflow
-- step. Allow its initial Pending state when created from a confirmed booking.
ALTER TABLE public.jobs
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'scheduled'::text, 'in_progress'::text, 'waiting_parts'::text, 'completed'::text, 'cancelled'::text]));
