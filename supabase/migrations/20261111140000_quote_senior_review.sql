-- Quote preparation and senior approval are separate steps.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS senior_approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS senior_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS senior_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS senior_approval_note text;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_senior_approval_status_check;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_senior_approval_status_check
  CHECK (senior_approval_status IN ('pending','approved','changes_requested','legacy_approved'));

UPDATE public.quotes
   SET senior_approval_status = CASE WHEN status = 'draft' THEN 'pending' ELSE 'legacy_approved' END,
       senior_approval_note = CASE WHEN status = 'draft' THEN senior_approval_note
         ELSE COALESCE(senior_approval_note,'Previously issued quote retained. No separate senior approval was recorded by the previous workflow.') END
 WHERE senior_approval_status = 'pending';

CREATE INDEX IF NOT EXISTS quotes_senior_review_queue_idx
  ON public.quotes (business_id, senior_approval_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.review_quote(
  p_quote_id uuid,
  p_business_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote record;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Choose approve or request changes.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'changes_requested' AND length(trim(coalesce(p_note,''))) < 5 THEN
    RAISE EXCEPTION 'Describe the quote changes required.' USING ERRCODE = '22023';
  END IF;

  SELECT id, status, senior_approval_status, prepared_by, enquiry_id
    INTO v_quote
    FROM public.quotes
   WHERE id = p_quote_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.senior_approval_status <> 'pending' THEN
    RAISE EXCEPTION 'This quote is not awaiting senior review.' USING ERRCODE = 'P0001';
  END IF;
  IF v_quote.prepared_by IS NOT NULL AND v_quote.prepared_by = p_actor_user_id THEN
    RAISE EXCEPTION 'A different authorised senior staff member must review this quote.' USING ERRCODE = 'P0001';
  END IF;

  IF v_quote.enquiry_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.enquiries e
     WHERE e.id = v_quote.enquiry_id
       AND e.business_id = p_business_id
       AND e.request_type = 'quote_request'
       AND e.archived_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This quote is not attached to an active Quote Request Jobcard.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.quotes
     SET senior_approval_status = p_decision,
         senior_approved_by = CASE WHEN p_decision = 'approved' THEN p_actor_user_id ELSE NULL END,
         senior_approved_at = CASE WHEN p_decision = 'approved' THEN v_now ELSE NULL END,
         senior_approval_note = NULLIF(left(trim(coalesce(p_note,'')),2000),''),
         updated_at = v_now
   WHERE id = p_quote_id
     AND business_id = p_business_id;

  INSERT INTO public.audit_events
    (business_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES
    (p_business_id, p_actor_user_id,
     CASE WHEN p_decision = 'approved' THEN 'quote.senior_approved' ELSE 'quote.returned_for_revision' END,
     'quote', p_quote_id,
     jsonb_build_object('decision',p_decision,'note',NULLIF(left(trim(coalesce(p_note,'')),2000),''),'reviewed_at',v_now));

  RETURN jsonb_build_object('success',true,'decision',p_decision,'reviewed_at',v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.review_quote(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_quote(uuid, uuid, uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.issue_quote_for_jobcard(
  p_quote_id uuid,
  p_business_id uuid,
  p_actor_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote record;
  v_enquiry record;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT id, business_id, enquiry_id, quote_number, status, total, senior_approval_status
    INTO v_quote
    FROM public.quotes
   WHERE id = p_quote_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.enquiry_id IS NULL
     OR v_quote.senior_approval_status NOT IN ('approved','legacy_approved') THEN
    RAISE EXCEPTION 'Only a senior-approved draft quote attached to a Jobcard can be issued.' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, request_type, stage, status, archived_at
    INTO v_enquiry
    FROM public.enquiries
   WHERE id = v_quote.enquiry_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_enquiry.request_type <> 'quote_request'
     OR v_enquiry.archived_at IS NOT NULL
     OR v_enquiry.status NOT IN ('new', 'reviewing', 'quoted') THEN
    RAISE EXCEPTION 'This Jobcard is not available for quoting.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.quotes
     SET status = 'sent',
         issue_date = (v_now AT TIME ZONE 'Australia/Sydney')::date,
         updated_at = v_now
   WHERE id = v_quote.id;

  UPDATE public.enquiries
     SET stage = 'quote_sent',
         status = 'quoted',
         updated_at = v_now
   WHERE id = v_enquiry.id
     AND business_id = p_business_id;

  IF v_enquiry.stage IS DISTINCT FROM 'quote_sent' THEN
    INSERT INTO public.enquiry_stage_history
      (business_id, enquiry_id, from_stage, to_stage, changed_by, note)
    VALUES
      (p_business_id, v_enquiry.id, v_enquiry.stage, 'quote_sent', p_actor_user_id,
       'Senior-approved quote ' || v_quote.quote_number || ' issued to the customer.');
  END IF;

  INSERT INTO public.audit_events
    (business_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES
    (p_business_id, p_actor_user_id, 'quote.issued', 'quote', v_quote.id,
     jsonb_build_object('quote_number', v_quote.quote_number, 'enquiry_id', v_enquiry.id, 'total', v_quote.total));

  RETURN jsonb_build_object('success', true, 'quote_id', v_quote.id,
    'quote_number', v_quote.quote_number, 'enquiry_id', v_enquiry.id);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_quote_for_jobcard(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_quote_for_jobcard(uuid, uuid, uuid) TO service_role;
