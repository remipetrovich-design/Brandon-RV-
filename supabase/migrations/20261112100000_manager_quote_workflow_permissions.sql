-- Give the Manager role the complete day-to-day operational workflow, including senior quote review.
-- This updates the shared role mapping, so existing and future Manager accounts receive the permissions.
INSERT INTO public.user_role_permissions(role_key, permission_key)
SELECT 'manager', permission_key
FROM public.permissions
WHERE permission_key = ANY (ARRAY[
  'customers.view','customers.manage',
  'vehicles.view','vehicles.manage',
  'enquiries.view','enquiries.manage',
  'quotes.view','quotes.manage','quotes.approve',
  'appointments.view','appointments.manage',
  'jobs.view','jobs.manage','jobs.assign','jobs.complete',
  'invoices.view','invoices.manage','payments.manage',
  'expenses.view','expenses.manage',
  'suppliers.view','suppliers.manage',
  'staff.view',
  'time.view','time.manage','time.clock',
  'leave.view','leave.manage',
  'assets.view','assets.manage',
  'onboarding.view','onboarding.manage',
  'documents.view','documents.manage',
  'communications.manage','reports.view'
])
ON CONFLICT (role_key, permission_key) DO NOTHING;

-- Managers are senior approvers and may approve a quote they prepared.
-- Other staff still require a different authorised senior reviewer.
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

  IF v_quote.prepared_by = p_actor_user_id AND NOT EXISTS (
    SELECT 1
      FROM public.users u
     WHERE u.id = p_actor_user_id
       AND u.status = 'active'
       AND (
         u.user_role IN ('owner','website_developer')
         OR (u.user_role = 'manager' AND u.employment_status = 'active')
       )
  ) THEN
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
