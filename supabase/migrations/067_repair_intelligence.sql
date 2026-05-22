-- 067: Repair intelligence summary
--
-- Adds intelligence_summary to bud_repair_executions so successful repair runs
-- can surface structured actionable output: what broke, how it was fixed, which
-- patterns to watch, and what agents may be at risk.

ALTER TABLE public.bud_repair_executions
  ADD COLUMN IF NOT EXISTS intelligence_summary text;
