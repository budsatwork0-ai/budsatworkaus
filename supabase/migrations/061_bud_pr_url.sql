-- 061: PR and issue URL persistence on bud_repair_executions
--
-- Adds two columns so that PR and GitHub issue URLs created during the repair
-- pipeline are stored on the execution row (not just returned transiently).
-- Mission Control reads these columns to render the PR / issue links in the
-- Repair Studio gate-results panel without needing a separate GitHub API call.
--
-- pr_url    — full GitHub pull-request URL, or NULL if no PR was opened
-- issue_url — full GitHub issue URL, or NULL if no issue was created

ALTER TABLE public.bud_repair_executions
  ADD COLUMN IF NOT EXISTS pr_url    text,
  ADD COLUMN IF NOT EXISTS issue_url text;

-- Partial index for quickly finding executions that produced a PR
CREATE INDEX IF NOT EXISTS idx_bud_repair_executions_pr_url
  ON public.bud_repair_executions (created_at DESC)
  WHERE pr_url IS NOT NULL;
