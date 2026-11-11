-- Customer Workcard decision and final invoice issue must succeed or fail together.
CREATE OR REPLACE FUNCTION public.respond_to_completed_workcard(
  p_job_id uuid,
  p_business_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_guest_enquiry_id uuid DEFAULT NULL,
  p_guest_token_hash text DEFAULT NULL,
  p_decision text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_invoice record;
  v_enquiry record;
  v_now timestamptz := clock_timestamp();
  v_message text;
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Choose approve or request changes.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'changes_requested' AND length(trim(coalesce(p_note,''))) < 5 THEN
    RAISE EXCEPTION 'Describe what needs attention before submitting.' USING ERRCODE = '22023';
  END IF;

  SELECT id,business_id,user_id,customer_id,job_number,status,customer_approval_status,
         senior_approval_status,appointment_id,quote_id
    INTO v_job
    FROM public.jobs
   WHERE id = p_job_id AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_job.status <> 'completed'
     OR v_job.senior_approval_status NOT IN ('approved','legacy_approved')
     OR v_job.customer_approval_status <> 'pending' THEN
    RAISE EXCEPTION 'This Workcard is not yet approved for customer review.' USING ERRCODE = 'P0001';
  END IF;

  IF p_actor_user_id IS NOT NULL THEN
    IF v_job.user_id IS DISTINCT FROM p_actor_user_id THEN
      RAISE EXCEPTION 'This Workcard does not belong to your account.' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF p_guest_enquiry_id IS NULL OR p_guest_token_hash IS NULL OR v_job.appointment_id IS NULL THEN
      RAISE EXCEPTION 'Guest Jobcard access is no longer available.' USING ERRCODE = 'P0001';
    END IF;
    SELECT id,business_id,contact_name,email
      INTO v_enquiry
      FROM public.enquiries
     WHERE id = p_guest_enquiry_id
       AND business_id = p_business_id
       AND request_type = 'quote_request'
       AND guest_access_token_hash = p_guest_token_hash
       AND guest_access_expires_at > v_now
     FOR UPDATE;
    IF NOT FOUND OR NOT EXISTS (
      SELECT 1 FROM public.appointments a
       WHERE a.id = v_job.appointment_id
         AND a.business_id = p_business_id
         AND a.enquiry_id = v_enquiry.id
         AND a.status = 'confirmed'
    ) THEN
      RAISE EXCEPTION 'Guest Jobcard access is no longer available.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  SELECT id,invoice_number,status
    INTO v_invoice
    FROM public.invoices
   WHERE job_id = v_job.id AND business_id = p_business_id
   FOR UPDATE;
  IF NOT FOUND OR v_invoice.status <> 'draft' THEN
    RAISE EXCEPTION 'The final invoice is not ready for customer approval.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.jobs
     SET customer_approval_status = p_decision,
         customer_approved_at = CASE WHEN p_decision = 'approved' THEN v_now ELSE NULL END,
         customer_approval_note = NULLIF(left(trim(coalesce(p_note,'')),2000),''),
         updated_at = v_now
   WHERE id = v_job.id AND business_id = p_business_id
     AND customer_approval_status = 'pending';

  IF p_decision = 'approved' THEN
    UPDATE public.invoices
       SET status = 'issued',
           issue_date = (v_now AT TIME ZONE 'Australia/Sydney')::date,
           updated_at = v_now
     WHERE id = v_invoice.id AND status = 'draft';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The final invoice could not be issued.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_message := CASE WHEN p_decision = 'approved'
    THEN 'Customer approved completed Workcard ' || v_job.job_number || '.'
    ELSE 'Customer requested changes to completed Workcard ' || v_job.job_number || ': ' || left(trim(p_note),2000)
  END;

  INSERT INTO public.customer_messages
    (business_id,customer_id,user_id,enquiry_id,quote_id,sender_type,sender_user_id,guest_name,guest_email,message,is_internal)
  VALUES
    (p_business_id,v_job.customer_id,p_actor_user_id,
     CASE WHEN p_guest_enquiry_id IS NOT NULL THEN p_guest_enquiry_id
          ELSE (SELECT enquiry_id FROM public.appointments WHERE id = v_job.appointment_id) END,
     v_job.quote_id,'customer',p_actor_user_id,
     CASE WHEN p_actor_user_id IS NULL THEN v_enquiry.contact_name ELSE NULL END,
     CASE WHEN p_actor_user_id IS NULL THEN v_enquiry.email ELSE NULL END,
     v_message,false);

  INSERT INTO public.audit_events
    (business_id,actor_user_id,action,entity_type,entity_id,details)
  VALUES
    (p_business_id,p_actor_user_id,
     CASE WHEN p_actor_user_id IS NULL THEN 'guest_work_order.customer_' ELSE 'work_order.customer_' END || p_decision,
     'job',v_job.id,
     jsonb_build_object('invoice_id',v_invoice.id,'invoice_status',CASE WHEN p_decision='approved' THEN 'issued' ELSE 'draft' END,
       'note',NULLIF(left(trim(coalesce(p_note,'')),2000),''),'request_id',p_guest_enquiry_id));

  RETURN jsonb_build_object('success',true,'decision',p_decision,
    'invoiceStatus',CASE WHEN p_decision='approved' THEN 'issued' ELSE 'draft' END,
    'invoiceNumber',v_invoice.invoice_number);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_completed_workcard(uuid,uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_completed_workcard(uuid,uuid,uuid,uuid,text,text,text) TO service_role;
