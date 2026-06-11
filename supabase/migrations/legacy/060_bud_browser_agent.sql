-- 060: Bud Browser Agent — golden-path Playwright test run storage
--
-- Stores results from every Playwright browser test run triggered by Bud OS.
-- Runs are associated with a bud_repair_execution and (optionally) a repair step.
-- The browser-executor.ts module writes to this table; the browser-agent reads from it.
--
-- Columns:
--   id                — pk
--   execution_id      — fk to bud_repair_executions (nullable: manual runs)
--   step_id           — fk to bud_repair_steps (nullable)
--   test_dir          — directory of tests that were run (e.g. tests/e2e/golden-paths)
--   project           — Playwright project (e.g. chromium, firefox, webkit)
--   exit_code         — raw process exit code (0 = all passed)
--   passed            — number of tests that passed
--   failed            — number of tests that failed
--   skipped           — number of tests that were skipped
--   total             — total test count
--   duration_ms       — total run duration in milliseconds
--   failures          — jsonb array of { title, file, error } for each failure
--   raw_output        — stdout from the Playwright JSON reporter (trimmed to 50 000 chars)
--   stderr_output     — stderr from the Playwright process (trimmed to 10 000 chars)
--   created_at        — when this run record was written

CREATE TABLE IF NOT EXISTS public.bud_browser_test_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id      uuid        REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL,
  step_id           uuid        REFERENCES public.bud_repair_steps(id)      ON DELETE SET NULL,
  test_dir          text        NOT NULL DEFAULT 'tests/e2e/golden-paths',
  project           text        NOT NULL DEFAULT 'chromium',
  exit_code         integer,
  passed            integer     NOT NULL DEFAULT 0,
  failed            integer     NOT NULL DEFAULT 0,
  skipped           integer     NOT NULL DEFAULT 0,
  total             integer     NOT NULL DEFAULT 0,
  duration_ms       integer     NOT NULL DEFAULT 0,
  failures          jsonb,
  raw_output        text,
  stderr_output     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Index for looking up runs by execution
CREATE INDEX IF NOT EXISTS idx_bud_browser_test_runs_execution_id
  ON public.bud_browser_test_runs (execution_id)
  WHERE execution_id IS NOT NULL;

-- Index for quickly finding failed runs (for alerting / reporting)
CREATE INDEX IF NOT EXISTS idx_bud_browser_test_runs_failed
  ON public.bud_browser_test_runs (failed, created_at DESC)
  WHERE failed > 0;

-- RLS: service role only (these are written by server-side Bud OS, not end-users)
ALTER TABLE public.bud_browser_test_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role only" ON public.bud_browser_test_runs;
CREATE POLICY "service role only"
  ON public.bud_browser_test_runs
  USING (auth.role() = 'service_role');

-- Add browser test columns to bud_repair_executions so the repair pipeline
-- can summarise the browser gate result alongside CI and taste.
ALTER TABLE public.bud_repair_executions
  ADD COLUMN IF NOT EXISTS browser_tests_passed   integer,
  ADD COLUMN IF NOT EXISTS browser_tests_failed   integer,
  ADD COLUMN IF NOT EXISTS browser_tests_total    integer,
  ADD COLUMN IF NOT EXISTS browser_test_status    text,   -- 'passed' | 'failed' | 'skipped' | 'blocked'
  ADD COLUMN IF NOT EXISTS browser_test_run_id    uuid REFERENCES public.bud_browser_test_runs(id);
