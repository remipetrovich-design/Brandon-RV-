-- Allow an authorised approver to approve records they created or signed off.
-- Permission checks remain enforced by the admin API; every decision remains audited.

CREATE OR REPLACE FUNCTION public.review_workcard(
  p_job_id uuid,
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
  v_job record;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Choose approve or request changes.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'changes_requested' AND length(trim(coalesce(p_note,''))) < 5 THEN
    RAISE EXCEPTION 'Describe the corrections required.' USING ERRCODE = '22023';
  END IF;

  SELECT id, status, senior_approval_status, worker_signed_off_at
    INTO v_job
    FROM public.jobs
   WHERE id = p_job_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_job.status <> 'completed'
     OR v_job.senior_approval_status <> 'pending'
     OR v_job.worker_signed_off_at IS NULL THEN
    RAISE EXCEPTION 'This Workcard is not awaiting senior review.' USING ERRCODE = 'P0001';
  END IF;

  IF p_decision = 'approved' THEN
    UPDATE public.jobs
       SET senior_approval_status = 'approved',
           senior_approved_by = p_actor_user_id,
           senior_approved_at = v_now,
           senior_approval_note = NULLIF(left(trim(coalesce(p_note,'')),2000),''),
           customer_approval_status = 'pending',
           updated_at = v_now
     WHERE id = p_job_id
       AND business_id = p_business_id;
  ELSE
    UPDATE public.jobs
       SET status = 'in_progress',
           senior_approval_status = 'changes_requested',
           senior_approved_by = NULL,
           senior_approved_at = NULL,
           senior_approval_note = left(trim(p_note),2000),
           worker_signed_off_by = NULL,
           worker_signed_off_at = NULL,
           customer_approval_status = 'not_ready',
           customer_approved_at = NULL,
           updated_at = v_now
     WHERE id = p_job_id
       AND business_id = p_business_id;

    UPDATE public.job_assignments
       SET status = 'accepted'
     WHERE job_id = p_job_id
       AND status = 'completed';

    DELETE FROM public.invoices
     WHERE job_id = p_job_id
       AND business_id = p_business_id
       AND status = 'draft';
  END IF;

  INSERT INTO public.audit_events
    (business_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES
    (p_business_id, p_actor_user_id,
     CASE WHEN p_decision = 'approved' THEN 'workcard.senior_approved' ELSE 'workcard.returned_for_correction' END,
     'job', p_job_id,
     jsonb_build_object('decision',p_decision,'note',NULLIF(left(trim(coalesce(p_note,'')),2000),''),'reviewed_at',v_now));

  RETURN jsonb_build_object('success',true,'decision',p_decision,'reviewed_at',v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.review_workcard(uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_workcard(uuid, uuid, uuid, text, text) TO service_role;

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

  SELECT id, status, senior_approval_status, enquiry_id
    INTO v_quote
    FROM public.quotes
   WHERE id = p_quote_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_quote.status <> 'draft' OR v_quote.senior_approval_status <> 'pending' THEN
    RAISE EXCEPTION 'This quote is not awaiting senior review.' USING ERRCODE = 'P0001';
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
