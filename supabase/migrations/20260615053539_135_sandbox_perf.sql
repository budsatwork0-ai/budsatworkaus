-- Migration 135 — Sandbox performance hardening
--
-- 1. Widen sandbox_run_batches.status to include 'cancelled' and 'pending'.
--    The DELETE /api/sandbox/run-pack/[batchId] cancel route sets
--    status='cancelled', which violates the CHECK constraint added in
--    migration 133 ('running' | 'complete' | 'failed' only).
--
-- 2. Create sandbox_lesson_counts_by_agent() RPC.
--    Replaces the unbounded .select('agent_id').limit(2000) scan in
--    GET /api/sandbox/health with a server-side COUNT(*) GROUP BY agent_id.
--    Eliminates the 2000-row cap and associated under-count risk.
--
-- 3. Add index on sandbox_lessons_learned(environment, agent_id) to back the RPC.
--
-- 4. Safe FK re-assertion for sandbox_decision_scores.response_id →
--    sandbox_agent_responses.id (present from migration 131; checked here
--    so the constraint is explicit in this audit trail).
--
-- Idempotent. No production tables touched.

-- ── 1. Widen status constraint on sandbox_run_batches ────────────────────────

DO $$
BEGIN
  -- Drop the old constraint if it exists under the expected name.
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'sandbox_run_batches'
      AND constraint_name = 'sandbox_run_batches_status_check'
  ) THEN
    ALTER TABLE public.sandbox_run_batches
      DROP CONSTRAINT sandbox_run_batches_status_check;
  END IF;

  -- Add the widened constraint.
  ALTER TABLE public.sandbox_run_batches
    ADD CONSTRAINT sandbox_run_batches_status_check
    CHECK (status IN ('pending', 'running', 'complete', 'failed', 'cancelled'));
END;
$$;

-- ── 2. RPC: sandbox_lesson_counts_by_agent ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sandbox_lesson_counts_by_agent()
RETURNS TABLE(agent_id text, lesson_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT agent_id, COUNT(*)::bigint AS lesson_count
  FROM   public.sandbox_lessons_learned
  WHERE  environment = 'sandbox'
  GROUP  BY agent_id;
$$;

-- Allow authenticated admin / service role to call the RPC.
REVOKE ALL ON FUNCTION public.sandbox_lesson_counts_by_agent() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sandbox_lesson_counts_by_agent() TO service_role;
GRANT EXECUTE ON FUNCTION public.sandbox_lesson_counts_by_agent() TO authenticated;

-- ── 3. Index for the RPC query ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_sandbox_lessons_env_agent
  ON public.sandbox_lessons_learned (environment, agent_id);

-- ── 4. FK re-assertion for sandbox_decision_scores.response_id ───────────────
--
-- The FK was created in migration 131. This block is a no-op if it already
-- exists; it ensures the constraint is present even if the table was recreated
-- outside the normal migration path (e.g. in a reset dev environment).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN   information_schema.key_column_usage kcu
           ON  kcu.constraint_name = tc.constraint_name
           AND kcu.table_schema    = tc.table_schema
    WHERE  tc.table_schema    = 'public'
      AND  tc.table_name      = 'sandbox_decision_scores'
      AND  tc.constraint_type = 'FOREIGN KEY'
      AND  kcu.column_name    = 'response_id'
  ) THEN
    ALTER TABLE public.sandbox_decision_scores
      ADD CONSTRAINT sandbox_decision_scores_response_id_fkey
      FOREIGN KEY (response_id)
      REFERENCES public.sandbox_agent_responses(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;
