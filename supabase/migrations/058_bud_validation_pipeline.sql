-- 058: Bud validation pipeline — CI tracking columns on bud_repair_executions
--
-- Adds four columns to track the GitHub Actions CI result for each autonomous
-- repair attempt. The repair executor writes these as it moves through the
-- validating lifecycle state before opening a PR.
--
-- ci_workflow_run_id — GitHub Actions run ID polled after patching
-- ci_conclusion      — 'success' | 'failure' | 'cancelled' | 'timed_out' | null
-- ci_run_url         — direct link to the workflow run in the GitHub UI
-- rollback_reason    — human-readable reason if the repair branch was deleted

ALTER TABLE public.bud_repair_executions
  ADD COLUMN IF NOT EXISTS ci_workflow_run_id  text,
  ADD COLUMN IF NOT EXISTS ci_conclusion       text,
  ADD COLUMN IF NOT EXISTS ci_run_url          text,
  ADD COLUMN IF NOT EXISTS rollback_reason     text;

-- Index to efficiently find executions with CI failures for reporting
CREATE INDEX IF NOT EXISTS idx_bud_repair_executions_ci_conclusion
  ON public.bud_repair_executions (ci_conclusion)
  WHERE ci_conclusion IS NOT NULL;
