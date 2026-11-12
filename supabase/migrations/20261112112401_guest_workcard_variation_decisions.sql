CREATE OR REPLACE FUNCTION public.respond_to_guest_job_variation(
 p_ticket_id uuid,p_quote_id uuid,p_guest_token_hash text,p_response text,p_response_note text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_enquiry record; v_quote record; v_job record; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_response NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'Choose accept or decline.' USING ERRCODE='22023'; END IF;
 SELECT id,business_id,contact_name,email INTO v_enquiry FROM public.enquiries
  WHERE id=p_ticket_id AND request_type='quote_request' AND user_id IS NULL
   AND guest_access_token_hash=p_guest_token_hash AND guest_access_expires_at>v_now
   AND archived_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Guest request access is no longer available.' USING ERRCODE='P0001'; END IF;
 SELECT id,business_id,enquiry_id,job_id,quote_number,status,user_id,customer_id INTO v_quote FROM public.quotes
  WHERE id=p_quote_id AND business_id=v_enquiry.business_id AND enquiry_id=v_enquiry.id
   AND quote_kind='variation' AND user_id IS NULL FOR UPDATE;
 IF NOT FOUND OR v_quote.status<>'sent' OR v_quote.job_id IS NULL THEN
  RAISE EXCEPTION 'This variation is no longer awaiting your decision.' USING ERRCODE='P0001';
 END IF;
 SELECT id,status,user_id INTO v_job FROM public.jobs WHERE id=v_quote.job_id
  AND business_id=v_quote.business_id FOR UPDATE;
 IF NOT FOUND OR v_job.user_id IS NOT NULL OR v_job.status NOT IN ('pending','scheduled','in_progress','waiting_parts') THEN
  RAISE EXCEPTION 'This Workcard is no longer available for variation approval.' USING ERRCODE='P0001';
 END IF;
 UPDATE public.quotes SET status=p_response,response_at=v_now,
  response_note=NULLIF(left(trim(coalesce(p_response_note,'')),1000),''),updated_at=v_now
 WHERE id=v_quote.id;
 IF p_response='accepted' THEN
  INSERT INTO public.job_work_entries(business_id,job_id,created_by,entry_type,description,quantity,unit_price,tax_rate,line_total,customer_visible,source_quote_item_id)
  SELECT v_quote.business_id,v_job.id,NULL,qi.item_type,qi.description,qi.quantity,qi.unit_price,qi.tax_rate,qi.line_total,true,qi.id
  FROM public.quote_items qi WHERE qi.quote_id=v_quote.id
  ON CONFLICT(source_quote_item_id) WHERE source_quote_item_id IS NOT NULL DO NOTHING;
 END IF;
 INSERT INTO public.customer_messages(business_id,customer_id,user_id,enquiry_id,quote_id,sender_type,sender_user_id,guest_name,guest_email,message,is_internal)
 VALUES(v_quote.business_id,NULL,NULL,v_enquiry.id,v_quote.id,'customer',NULL,v_enquiry.contact_name,v_enquiry.email,
  'Variation '||v_quote.quote_number||' was '||p_response||' by the guest customer.'
   ||CASE WHEN NULLIF(trim(coalesce(p_response_note,'')),'') IS NULL THEN '' ELSE ' Customer note: '||left(p_response_note,1000) END,false);
 INSERT INTO public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(v_quote.business_id,NULL,'guest_workcard.variation_'||p_response,'quote',v_quote.id,
  jsonb_build_object('job_id',v_job.id,'quote_number',v_quote.quote_number,'response_at',v_now,
   'response_note',NULLIF(left(trim(coalesce(p_response_note,'')),1000),'')));
 RETURN jsonb_build_object('success',true,'response',p_response,'quote_id',v_quote.id,'job_id',v_job.id,'response_at',v_now);
END; $$;
REVOKE ALL ON FUNCTION public.respond_to_guest_job_variation(uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_guest_job_variation(uuid,uuid,text,text,text) TO service_role;