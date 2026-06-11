-- 118_research_trends_adaptation_columns.sql
-- Adds adaptation scoring columns to research_trends.
-- The Adaptation Validator agent writes these after scoring each trend against
-- active story arcs. The base table (104_research_trends.sql) predates the agent.

ALTER TABLE public.research_trends
  ADD COLUMN IF NOT EXISTS adaptation_score  integer CHECK (adaptation_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS adaptation_reason text,
  ADD COLUMN IF NOT EXISTS adapted_at        timestamptz;

CREATE INDEX IF NOT EXISTS idx_research_trends_adaptation_score
  ON public.research_trends(adaptation_score DESC NULLS LAST);
