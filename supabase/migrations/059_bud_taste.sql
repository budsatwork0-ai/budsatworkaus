-- 059: Bud Taste — Design Constitution visual compliance scores
--
-- Adds six columns to bud_repair_executions to record the Design Constitution
-- taste check that runs after CI validation on UI-touching repairs.
-- The visual scorer (src/lib/bud/visual-scorer.ts) writes these columns before
-- the PR is opened. A failing taste score causes the PR to open as a draft.
--
-- taste_score         — 0.000–1.000 (pass threshold defined in design-constitution.ts: 0.70)
-- taste_pass          — true when score >= threshold
-- taste_violations    — jsonb array of violated rule descriptions
-- taste_suggestions   — jsonb array of improvement suggestions from the evaluator
-- taste_checked_files — jsonb array of file paths that were evaluated
-- taste_checked_at    — when the taste score was recorded

ALTER TABLE public.bud_repair_executions
  ADD COLUMN IF NOT EXISTS taste_score          numeric(4,3),
  ADD COLUMN IF NOT EXISTS taste_pass           boolean,
  ADD COLUMN IF NOT EXISTS taste_violations     jsonb,
  ADD COLUMN IF NOT EXISTS taste_suggestions    jsonb,
  ADD COLUMN IF NOT EXISTS taste_checked_files  jsonb,
  ADD COLUMN IF NOT EXISTS taste_checked_at     timestamptz;

-- Partial index to efficiently find executions where visual taste failed (for reporting / alerting)
CREATE INDEX IF NOT EXISTS idx_bud_repair_executions_taste_pass
  ON public.bud_repair_executions (taste_pass)
  WHERE taste_pass IS NOT NULL;
