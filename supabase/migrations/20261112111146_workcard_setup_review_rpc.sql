CREATE OR REPLACE FUNCTION public.review_workcard_setup(
 p_job_id uuid,p_business_id uuid,p_actor_user_id uuid,p_decision text,p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_job record; v_now timestamptz:=clock_timestamp();
BEGIN
 IF p_decision NOT IN ('approved','changes_requested') THEN RAISE EXCEPTION 'Choose approve or request changes.' USING ERRCODE='22023'; END IF;
 IF p_decision='changes_requested' AND length(trim(coalesce(p_note,'')))<5 THEN RAISE EXCEPTION 'Describe the changes required.' USING ERRCODE='22023'; END IF;
 SELECT id,workcard_review_status INTO v_job FROM public.jobs
  WHERE id=p_job_id AND business_id=p_business_id FOR UPDATE;
 IF NOT FOUND OR v_job.workcard_review_status NOT IN ('pending_review','changes_requested') THEN
  RAISE EXCEPTION 'This Workcard is no longer awaiting setup review.' USING ERRCODE='P0001';
 END IF;
 UPDATE public.jobs SET workcard_review_status=p_decision,
  workcard_review_note=NULLIF(left(trim(coalesce(p_note,'')),2000),''),
  workcard_reviewed_by=CASE WHEN p_decision='approved' THEN p_actor_user_id ELSE NULL END,
  workcard_reviewed_at=CASE WHEN p_decision='approved' THEN v_now ELSE NULL END,
  updated_at=v_now
 WHERE id=p_job_id AND business_id=p_business_id;
 INSERT INTO public.audit_events(business_id,actor_user_id,action,entity_type,entity_id,details)
 VALUES(p_business_id,p_actor_user_id,
  CASE WHEN p_decision='approved' THEN 'workcard.setup_approved' ELSE 'workcard.setup_changes_requested' END,
  'job',p_job_id,jsonb_build_object('decision',p_decision,'note',NULLIF(left(trim(coalesce(p_note,'')),2000),''),'reviewed_at',v_now));
 RETURN jsonb_build_object('success',true,'decision',p_decision,'reviewed_at',v_now);
END; $$;
REVOKE ALL ON FUNCTION public.review_workcard_setup(uuid,uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.review_workcard_setup(uuid,uuid,uuid,text,text) TO service_role;