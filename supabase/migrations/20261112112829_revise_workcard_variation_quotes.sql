-- Restore the exact variation-revision function recorded in production migration history.
CREATE OR REPLACE FUNCTION public.revise_job_variation_quote(
 p_quote_id uuid,
 p_business_id uuid,
 p_actor_user_id uuid,
 p_reason text,
 p_items jsonb,
 p_tax_rate numeric,
 p_notes text DEFAULT NULL,
 p_terms text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
 v_old record;
 v_now timestamptz:=clock_timestamp();
 v_subtotal numeric(12,2);
 v_tax numeric(12,2);
 v_total numeric(12,2);
 v_new public.quotes%ROWTYPE;
 v_number text;
BEGIN
 IF length(trim(coalesce(p_reason,'')))<5 OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>30 OR p_tax_rate<0 OR p_tax_rate>100 THEN
  RAISE EXCEPTION 'Invalid variation revision details.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_old FROM public.quotes WHERE id=p_quote_id AND business_id=p_business_id
  AND quote_kind='variation' AND status='draft' AND senior_approval_status='changes_requested' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Only a variation returned for revision can be revised.' USING ERRCODE='P0001'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x WHERE
  coalesce(x->>'item_type','') NOT IN ('labour','parts') OR length(trim(coalesce(x->>'description','')))<3
  OR coalesce((x->>'quantity')::numeric,0)<=0 OR coalesce((x->>'unit_price')::numeric,-1)<0) THEN
  RAISE EXCEPTION 'Variation line items are invalid.' USING ERRCODE='22023';
 END IF;
 SELECT round(sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric),2),
  round(sum((x->>'quantity')::numeric*(x->>'unit_price')::numeric*p_tax_rate/100),2)
 INTO v_subtotal,v_tax FROM jsonb_array_elements(p_items) x;
 v_subtotal:=coalesce(v_subtotal,0);v_tax:=coalesce(v_tax,0);v_total:=v_subtotal+v_tax;
 UPDATE public.quotes SET status='superseded',updated_at=v_now WHERE id=v_old.id;
 v_number:='BRV-V-'||upper(to_char(v_now AT TIME ZONE 'Australia/Sydney','YYMMDDHH24MISS'))||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
 INSERT INTO public.quotes(business_id,customer_id,user_id,enquiry_id,job_id,quote_kind,variation_reason,
  quote_number,status,revision_number,supersedes_quote_id,prepared_by,senior_approval_status,
  subtotal,tax_amount,total,notes,terms,created_at,updated_at)
 VALUES(v_old.business_id,v_old.customer_id,v_old.user_id,v_old.enquiry_id,v_old.job_id,'variation',
  left(trim(p_reason),2000),v_number,'draft',v_old.revision_number+1,v_old.id,p_actor_user_id,'pending',
  v_subtotal,v_tax,v_total,nullif(left(trim(coalesce(p_notes,'')),3000),''),nullif(left(trim(coalesce(p_terms,'')),3000),''),v_now,v_now)
 RETURNING * INTO v_new;
 INSERT INTO public.quote_items(quote_id,item_type,description,quantity,unit_price,tax_rate,line_total,sort_order)
 SELECT v_new.id,x->>'item_type',left(trim(x->>'description'),500),(x->>'quantity')::numeric,
  (x->>'unit_price')::numeric,p_tax_rate,
  round((x->>'quantity')::numeric*(x->>'unit_price')::numeric*(1+p_tax_rate/100),2),
  coalesce((x->>'sort_order')::integer,0)
 FROM jsonb_array_elements(p_items) x;
 INSERT INTO public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(p_business_id,p_actor_user_id,'workcard.variation_revised','quote',v_new.id,
  jsonb_build_object('previous_quote_id',v_old.id,'previous_quote_number',v_old.quote_number,'revision_number',v_new.revision_number,'total',v_total));
 RETURN jsonb_build_object('success',true,'quote_id',v_new.id,'quote_number',v_new.quote_number,'revision_number',v_new.revision_number,'total',v_new.total);
END;
$function$;
