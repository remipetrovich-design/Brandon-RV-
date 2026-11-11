-- Workcards are created from accepted quotes, before booking coordination.
-- Existing Work Orders retain their current workflow as legacy-approved records.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS workcard_review_status text NOT NULL DEFAULT 'legacy_approved',
  ADD COLUMN IF NOT EXISTS workcard_reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS workcard_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS workcard_review_note text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_workcard_review_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_workcard_review_status_check
  CHECK (workcard_review_status IN ('pending_review','approved','changes_requested','legacy_approved'));

CREATE INDEX IF NOT EXISTS jobs_workcard_review_status_idx
  ON public.jobs (business_id, workcard_review_status, created_at DESC);

CREATE OR REPLACE FUNCTION public.review_workcard_setup(
  p_job_id uuid,
  p_business_id uuid,
  p_actor_user_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_quote public.quotes%ROWTYPE;
  v_now timestamptz := now();
  v_note text := NULLIF(left(trim(COALESCE(p_note, '')), 2000), '');
BEGIN
  IF p_decision NOT IN ('approved','changes_requested') THEN
    RAISE EXCEPTION 'Choose approve or request changes.';
  END IF;
  IF p_decision = 'changes_requested' AND length(COALESCE(v_note,'')) < 5 THEN
    RAISE EXCEPTION 'Describe the changes required.';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE id = p_job_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Workcard not found.'; END IF;

  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = v_job.quote_id AND business_id = p_business_id
  FOR UPDATE;
  IF NOT FOUND OR v_quote.status <> 'accepted' THEN
    RAISE EXCEPTION 'A Workcard can only be reviewed against an accepted quote.';
  END IF;
  IF v_job.workcard_review_status NOT IN ('pending_review','changes_requested') THEN
    RAISE EXCEPTION 'This Workcard is not awaiting setup review.';
  END IF;

  UPDATE public.jobs
  SET workcard_review_status = p_decision,
      workcard_reviewed_by = p_actor_user_id,
      workcard_reviewed_at = v_now,
      workcard_review_note = v_note,
      updated_at = v_now
  WHERE id = p_job_id;

  INSERT INTO public.audit_events (
    business_id, actor_user_id, action, entity_type, entity_id, details
  ) VALUES (
    p_business_id, p_actor_user_id, 'workcard.setup_reviewed', 'job', p_job_id,
    jsonb_build_object('decision', p_decision, 'note', v_note, 'quote_id', v_job.quote_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'workcard_review_status', p_decision,
    'reviewed_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_workcard_setup(uuid,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_workcard_setup(uuid,uuid,uuid,text,text) TO service_role;
