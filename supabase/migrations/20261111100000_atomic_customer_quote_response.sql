-- Record quote decisions and update the Jobcard in one transaction.
-- This prevents a declined quote being left in an active queue if archival fails.
CREATE OR REPLACE FUNCTION public.respond_to_customer_quote(
  p_quote_id uuid,
  p_user_id uuid,
  p_response text,
  p_response_note text DEFAULT NULL
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
  v_target_stage text;
  v_message text;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid quote response.' USING ERRCODE = '22023';
  END IF;

  SELECT id, business_id, enquiry_id, quote_number, status
    INTO v_quote
    FROM public.quotes
   WHERE id = p_quote_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND OR v_quote.status <> 'sent' THEN
    RAISE EXCEPTION 'Quote is no longer available for a response.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.quotes
     SET status = p_response,
         response_at = v_now,
         response_note = NULLIF(left(trim(coalesce(p_response_note, '')), 1000), ''),
         updated_at = v_now
   WHERE id = v_quote.id;

  IF v_quote.enquiry_id IS NOT NULL THEN
    SELECT id, stage
      INTO v_enquiry
      FROM public.enquiries
     WHERE id = v_quote.enquiry_id
       AND business_id = v_quote.business_id
     FOR UPDATE;

    IF FOUND THEN
      v_target_stage := CASE WHEN p_response = 'declined' THEN 'closed' ELSE 'approved' END;

      UPDATE public.enquiries
         SET stage = v_target_stage,
             status = CASE WHEN p_response = 'declined' THEN 'closed' ELSE 'accepted' END,
             archived_at = CASE WHEN p_response = 'declined' THEN v_now ELSE archived_at END,
             guest_access_token_hash = CASE WHEN p_response = 'declined' THEN NULL ELSE guest_access_token_hash END,
             guest_access_expires_at = CASE WHEN p_response = 'declined' THEN v_now ELSE guest_access_expires_at END,
             updated_at = v_now
       WHERE id = v_enquiry.id
         AND business_id = v_quote.business_id;

      IF v_enquiry.stage IS DISTINCT FROM v_target_stage THEN
        INSERT INTO public.enquiry_stage_history
          (business_id, enquiry_id, from_stage, to_stage, changed_by, note)
        VALUES
          (v_quote.business_id, v_enquiry.id, v_enquiry.stage, v_target_stage, p_user_id,
           CASE WHEN p_response = 'declined'
             THEN 'Customer declined quote ' || v_quote.quote_number || '; Jobcard closed, archived and guest access revoked.'
             ELSE 'Customer accepted quote ' || v_quote.quote_number || '; Jobcard moved to booking coordination.'
           END);
      END IF;
    END IF;
  END IF;

  v_message := CASE WHEN p_response = 'declined'
    THEN 'Quote ' || v_quote.quote_number || ' was declined by the customer. The request has been closed and archived.'
    ELSE 'Quote ' || v_quote.quote_number || ' was accepted by the customer.'
  END;
  IF NULLIF(trim(coalesce(p_response_note, '')), '') IS NOT NULL THEN
    v_message := v_message || ' Customer note: ' || left(trim(p_response_note), 1000);
  END IF;

  INSERT INTO public.customer_messages
    (business_id, customer_id, user_id, enquiry_id, quote_id, sender_type, sender_user_id, message, is_internal)
  VALUES
    (v_quote.business_id, p_user_id, p_user_id, v_quote.enquiry_id, v_quote.id, 'customer', p_user_id, v_message, false);

  INSERT INTO public.audit_events
    (business_id, actor_user_id, action, entity_type, entity_id, details)
  VALUES
    (v_quote.business_id, p_user_id,
     CASE WHEN p_response = 'declined' THEN 'quote.declined_and_request_archived' ELSE 'quote.accepted' END,
     'quote', v_quote.id,
     jsonb_build_object('quote_number', v_quote.quote_number, 'response_at', v_now,
       'response_note', NULLIF(left(trim(coalesce(p_response_note, '')), 1000), ''),
       'enquiry_id', v_quote.enquiry_id, 'request_closed', p_response = 'declined'));

  RETURN jsonb_build_object('success', true, 'response', p_response,
    'quote_id', v_quote.id, 'enquiry_id', v_quote.enquiry_id,
    'request_archived', p_response = 'declined', 'response_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_customer_quote(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_customer_quote(uuid, uuid, text, text) TO service_role;
