-- Record an invoice payment and archive the Jobcard only when it is fully paid.
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_invoice_id uuid,
  p_business_id uuid,
  p_actor_user_id uuid,
  p_amount numeric,
  p_method text,
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_payment record;
  v_amount_paid numeric(12,2);
  v_balance numeric(12,2);
  v_status text;
  v_job record;
  v_enquiry record;
  v_enquiry_id uuid;
  v_now timestamptz := clock_timestamp();
  v_archived boolean := false;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 10000000 THEN
    RAISE EXCEPTION 'Enter a valid payment amount.' USING ERRCODE = '22023';
  END IF;
  IF p_method NOT IN ('cash','bank_transfer','card','other') THEN
    RAISE EXCEPTION 'Select a valid payment method.' USING ERRCODE = '22023';
  END IF;

  SELECT id, customer_id, user_id, job_id, quote_id, total, amount_paid, status
    INTO v_invoice
    FROM public.invoices
   WHERE id = p_invoice_id
     AND business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND OR v_invoice.status IN ('draft','void','paid') THEN
    RAISE EXCEPTION 'This invoice cannot accept another payment.' USING ERRCODE = 'P0001';
  END IF;

  v_balance := round(v_invoice.total - v_invoice.amount_paid, 2);
  IF p_amount > v_balance + 0.005 THEN
    RAISE EXCEPTION 'Payment exceeds the outstanding balance.' USING ERRCODE = '22023';
  END IF;

  IF v_invoice.job_id IS NOT NULL THEN
    SELECT id, status, senior_approval_status, customer_approval_status, appointment_id, quote_id
      INTO v_job
      FROM public.jobs
     WHERE id = v_invoice.job_id
       AND business_id = p_business_id
     FOR UPDATE;
    IF NOT FOUND OR v_job.status <> 'completed'
       OR v_job.customer_approval_status <> 'approved'
       OR v_job.senior_approval_status NOT IN ('approved','legacy_approved') THEN
      RAISE EXCEPTION 'The customer-approved final Workcard is required before payment.' USING ERRCODE = 'P0001';
    END IF;

    IF v_job.appointment_id IS NOT NULL THEN
      SELECT enquiry_id INTO v_enquiry_id
        FROM public.appointments
       WHERE id = v_job.appointment_id
         AND business_id = p_business_id;
    END IF;
    IF v_enquiry_id IS NULL AND v_job.quote_id IS NOT NULL THEN
      SELECT enquiry_id INTO v_enquiry_id
        FROM public.quotes
       WHERE id = v_job.quote_id
         AND business_id = p_business_id;
    END IF;
  END IF;

  v_amount_paid := round(v_invoice.amount_paid + p_amount, 2);
  v_status := CASE WHEN v_amount_paid + 0.005 >= v_invoice.total THEN 'paid' ELSE 'part_paid' END;

  INSERT INTO public.payments
    (business_id, invoice_id, customer_id, user_id, amount, method, reference, status, paid_at)
  VALUES
    (p_business_id, v_invoice.id, v_invoice.customer_id, v_invoice.user_id,
     p_amount, p_method, NULLIF(left(trim(coalesce(p_reference,'')),120),''), 'recorded', v_now)
  RETURNING id, amount, paid_at INTO v_payment;

  UPDATE public.invoices
     SET amount_paid = v_amount_paid,
         status = v_status,
         updated_at = v_now
   WHERE id = v_invoice.id
     AND business_id = p_business_id;

  IF v_status = 'paid' AND v_enquiry_id IS NOT NULL THEN
    SELECT id, stage, request_type, archived_at
      INTO v_enquiry
      FROM public.enquiries
     WHERE id = v_enquiry_id
       AND business_id = p_business_id
     FOR UPDATE;

    IF FOUND AND v_enquiry.request_type = 'quote_request' AND v_enquiry.archived_at IS NULL THEN
      UPDATE public.enquiries
         SET stage = 'closed',
             status = 'closed',
             archived_at = v_now,
             guest_access_token_hash = NULL,
             guest_access_expires_at = NULL,
             updated_at = v_now
       WHERE id = v_enquiry_id
         AND business_id = p_business_id;

      INSERT INTO public.enquiry_stage_history
        (business_id, enquiry_id, from_stage, to_stage, changed_by, note)
      VALUES
        (p_business_id, v_enquiry_id, v_enquiry.stage, 'closed', p_actor_user_id,
         'Jobcard archived after final customer approval and full invoice payment.');

      v_archived := true;
    END IF;
  END IF;

  INSERT INTO public.audit_events
    (business_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES
    (p_business_id, p_actor_user_id, 'payment.recorded', 'payment', v_payment.id,
     jsonb_build_object('invoice_id',v_invoice.id,'amount',p_amount,'method',p_method,'invoice_status',v_status,'jobcard_archived',v_archived));

  RETURN jsonb_build_object('success',true,'payment',jsonb_build_object('id',v_payment.id,'amount',v_payment.amount,'paid_at',v_payment.paid_at),
    'amountPaid',v_amount_paid,'balance',round(v_invoice.total-v_amount_paid,2),'invoiceStatus',v_status,'jobcardArchived',v_archived);
END;
$$;

REVOKE ALL ON FUNCTION public.record_invoice_payment(uuid, uuid, uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(uuid, uuid, uuid, numeric, text, text) TO service_role;
