-- Separate worker completion from management/senior approval.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS worker_signed_off_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS worker_signed_off_at timestamptz,
  ADD COLUMN IF NOT EXISTS senior_approval_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS senior_approved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS senior_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS senior_approval_note text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_senior_approval_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_senior_approval_status_check
  CHECK (senior_approval_status IN ('not_submitted','pending','approved','changes_requested','legacy_approved'));

-- Preserve existing completed Workcards without falsely recording a new approver.
UPDATE public.jobs
   SET senior_approval_status = 'legacy_approved',
       worker_signed_off_at = COALESCE(worker_signed_off_at, completed_at),
       senior_approval_note = COALESCE(senior_approval_note, 'Legacy completed record retained. No separate senior sign-off was captured by the previous workflow.')
 WHERE status = 'completed'
   AND customer_approval_status IN ('pending','approved','changes_requested');

CREATE INDEX IF NOT EXISTS jobs_senior_review_queue_idx
  ON public.jobs (business_id, senior_approval_status, completed_at DESC);

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
