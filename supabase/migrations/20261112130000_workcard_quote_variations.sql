-- Preserve the original accepted quote and manage extra work as separately approved variations.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_kind text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS variation_reason text;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_quote_kind_check;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_quote_kind_check CHECK (quote_kind IN ('standard','variation'));

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'parts';
ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_item_type_check;
ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_item_type_check CHECK (item_type IN ('labour','parts'));

ALTER TABLE public.job_work_entries
  ADD COLUMN IF NOT EXISTS source_quote_item_id uuid REFERENCES public.quote_items(id) ON DELETE SET NULL;
ALTER TABLE public.job_work_entries
  DROP CONSTRAINT IF EXISTS job_work_entries_entry_type_check;
ALTER TABLE public.job_work_entries
  ADD CONSTRAINT job_work_entries_entry_type_check CHECK (entry_type IN ('labour','parts','note','test'));
CREATE UNIQUE INDEX IF NOT EXISTS job_work_entries_source_quote_item_uidx
  ON public.job_work_entries(source_quote_item_id) WHERE source_quote_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS quotes_job_kind_status_idx
  ON public.quotes(business_id,job_id,quote_kind,status) WHERE job_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.issue_job_variation_quote(
  p_quote_id uuid,p_business_id uuid,p_actor_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_quote record; v_job record; v_now timestamptz:=clock_timestamp();
BEGIN
  SELECT id,business_id,job_id,quote_number,status,senior_approval_status,total
    INTO v_quote FROM public.quotes
   WHERE id=p_quote_id AND business_id=p_business_id AND quote_kind='variation'
   FOR UPDATE;
  IF NOT FOUND OR v_quote.status<>'draft'
     OR v_quote.senior_approval_status NOT IN ('approved','legacy_approved')
     OR v_quote.job_id IS NULL THEN
    RAISE EXCEPTION 'Only a senior-approved draft variation can be issued.' USING ERRCODE='P0001';
  END IF;
  SELECT id,status,user_id,enquiry_id INTO v_job FROM public.jobs
   WHERE id=v_quote.job_id AND business_id=p_business_id FOR UPDATE;
  IF NOT FOUND OR v_job.status NOT IN ('pending','scheduled','in_progress','waiting_parts') THEN
    RAISE EXCEPTION 'This Workcard is no longer open for variations.' USING ERRCODE='P0001';
  END IF;
  IF EXISTS(SELECT 1 FROM public.quotes q WHERE q.job_id=v_job.id AND q.quote_kind='variation' AND q.id<>v_quote.id AND q.status IN ('draft','sent')) THEN
    RAISE EXCEPTION 'Another variation is already awaiting review or customer decision.' USING ERRCODE='P0001';
  END IF;
  UPDATE public.quotes SET status='sent',
    issue_date=(v_now AT TIME ZONE 'Australia/Sydney')::date,updated_at=v_now
   WHERE id=v_quote.id;
  INSERT INTO public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,details)
  VALUES(p_business_id,p_actor_user_id,'workcard.variation_issued','quote',v_quote.id,
    jsonb_build_object('job_id',v_job.id,'quote_number',v_quote.quote_number,'total',v_quote.total));
  RETURN jsonb_build_object('success',true,'quote_id',v_quote.id,'job_id',v_job.id,'quote_number',v_quote.quote_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_job_variation(
  p_quote_id uuid,p_user_id uuid,p_response text,p_response_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_quote record; v_job record; v_now timestamptz:=clock_timestamp();
BEGIN
  IF p_response NOT IN ('accepted','declined') THEN
    RAISE EXCEPTION 'Choose accept or decline.' USING ERRCODE='22023';
  END IF;
  SELECT id,business_id,job_id,enquiry_id,customer_id,user_id,quote_number,status,total
    INTO v_quote FROM public.quotes
   WHERE id=p_quote_id AND user_id=p_user_id AND quote_kind='variation'
   FOR UPDATE;
  IF NOT FOUND OR v_quote.status<>'sent' OR v_quote.job_id IS NULL THEN
    RAISE EXCEPTION 'This variation is no longer awaiting your decision.' USING ERRCODE='P0001';
  END IF;
  SELECT id,status,user_id INTO v_job FROM public.jobs
   WHERE id=v_quote.job_id AND business_id=v_quote.business_id FOR UPDATE;
  IF NOT FOUND OR v_job.user_id<>p_user_id OR v_job.status NOT IN ('pending','scheduled','in_progress','waiting_parts') THEN
    RAISE EXCEPTION 'This Workcard is no longer available for variation approval.' USING ERRCODE='P0001';
  END IF;
  UPDATE public.quotes SET status=p_response,response_at=v_now,
    response_note=NULLIF(left(trim(coalesce(p_response_note,'')),1000),''),
    updated_at=v_now WHERE id=v_quote.id;
  IF p_response='accepted' THEN
    INSERT INTO public.job_work_entries(
      business_id,job_id,created_by,entry_type,description,quantity,unit_price,tax_rate,line_total,
      customer_visible,source_quote_item_id
    )
    SELECT v_quote.business_id,v_job.id,p_user_id,qi.item_type,qi.description,qi.quantity,
      qi.unit_price,qi.tax_rate,qi.line_total,true,qi.id
    FROM public.quote_items qi WHERE qi.quote_id=v_quote.id
    ON CONFLICT(source_quote_item_id) WHERE source_quote_item_id IS NOT NULL DO NOTHING;
  END IF;
  INSERT INTO public.customer_messages(business_id,customer_id,user_id,enquiry_id,quote_id,sender_type,sender_user_id,message,is_internal)
  VALUES(v_quote.business_id,v_quote.customer_id,p_user_id,v_quote.enquiry_id,v_quote.id,'customer',p_user_id,
    'Variation '||v_quote.quote_number||' was '||p_response||' by the customer.'
      ||CASE WHEN NULLIF(trim(coalesce(p_response_note,'')),'') IS NULL THEN '' ELSE ' Customer note: '||left(trim(p_response_note),1000) END,
    false);
  INSERT INTO public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,details)
  VALUES(v_quote.business_id,p_user_id,'workcard.variation_'||p_response,'quote',v_quote.id,
    jsonb_build_object('job_id',v_job.id,'quote_number',v_quote.quote_number,'response_at',v_now,
      'response_note',NULLIF(left(trim(coalesce(p_response_note,'')),1000),'')));
  RETURN jsonb_build_object('success',true,'response',p_response,'quote_id',v_quote.id,'job_id',v_job.id,'response_at',v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.issue_job_variation_quote(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_to_job_variation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_job_variation_quote(uuid,uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_job_variation(uuid,uuid,text,text) TO service_role;
