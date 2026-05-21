-- 062: Rollback trigger monitoring + repair learning semantic embeddings
--
-- Phase 6: Staged rollout + memory
--
-- 1. bud_rollback_events — records every rollback trigger so Bud can learn
--    which agents/root-cause types cause the most repair failures.
--    Written by repair-executor.ts whenever a CI failure, surgical limit, or
--    taste failure forces a branch deletion / draft-PR escalation.
--
-- 2. bud_repair_learnings.summary_embedding — adds a 1536-dim pgvector column
--    so that searchHistoricalContext() can do semantic similarity search over
--    past repair learnings rather than exact root_cause_type matching.
--    The repair executor writes embeddings fire-and-forget via OpenAI
--    text-embedding-3-small (same model used for agent_runs since migration 057).
--
-- 3. search_repair_learnings() RPC — convenience function for similarity search.
--
-- 4. v_bud_rollback_trends — aggregate rollback counts by agent + trigger type.
--
-- 5. v_bud_repair_success_rate — 30-day repair success rate per agent (for
--    Mission Control's authority / reliability score).

-- ── 1. Rollback events ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bud_rollback_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id    uuid        REFERENCES public.bud_repair_executions(id) ON DELETE SET NULL,
  agent_id        text,
  -- trigger values: 'ci_failure' | 'surgical_limit' | 'taste_failure' | 'browser_failure' | 'manual'
  trigger         text        NOT NULL,
  branch_name     text,
  ci_conclusion   text,
  ci_run_url      text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bud_rollback_events_agent
  ON public.bud_rollback_events (agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bud_rollback_events_trigger
  ON public.bud_rollback_events (trigger, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bud_rollback_events_execution
  ON public.bud_rollback_events (execution_id);

ALTER TABLE public.bud_rollback_events ENABLE ROW LEVEL SECURITY;

-- Service role can do anything; authenticated users can read
DROP POLICY IF EXISTS "Service role manages rollback events" ON public.bud_rollback_events;
CREATE POLICY "Service role manages rollback events"
  ON public.bud_rollback_events FOR ALL
  USING (true);

DROP POLICY IF EXISTS "Authenticated users read rollback events" ON public.bud_rollback_events;
CREATE POLICY "Authenticated users read rollback events"
  ON public.bud_rollback_events FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ── 2. Repair learning embeddings ─────────────────────────────────────────────

ALTER TABLE public.bud_repair_learnings
  ADD COLUMN IF NOT EXISTS summary_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_bud_repair_learnings_embedding
  ON public.bud_repair_learnings
  USING ivfflat (summary_embedding vector_cosine_ops)
  WITH (lists = 10);

-- ── 3. Semantic search RPC ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION search_repair_learnings(
  query_embedding vector(1536),
  match_count     int DEFAULT 5
)
RETURNS TABLE (
  id              uuid,
  root_cause_type text,
  fix_pattern     text,
  outcome         text,
  created_at      timestamptz,
  similarity      float
) LANGUAGE sql STABLE AS $$
  SELECT
    id,
    root_cause_type,
    fix_pattern,
    outcome,
    created_at,
    1 - (summary_embedding <=> query_embedding) AS similarity
  FROM public.bud_repair_learnings
  WHERE summary_embedding IS NOT NULL
  ORDER BY summary_embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── 4. Rollback trend view ────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_bud_rollback_trends AS
SELECT
  agent_id,
  COUNT(*)                                                       AS total_rollbacks,
  COUNT(*) FILTER (WHERE trigger = 'ci_failure')                AS ci_failures,
  COUNT(*) FILTER (WHERE trigger = 'surgical_limit')            AS surgical_limits,
  COUNT(*) FILTER (WHERE trigger = 'taste_failure')             AS taste_failures,
  COUNT(*) FILTER (WHERE trigger = 'browser_failure')           AS browser_failures,
  MIN(created_at)                                               AS first_rollback,
  MAX(created_at)                                               AS last_rollback
FROM public.bud_rollback_events
GROUP BY agent_id;

-- ── 5. Repair success rate view ───────────────────────────────────────────────
-- Compares total repair pipeline runs vs. rollback events in the last 30 days.
-- Used by Mission Control's authority reliability score.

CREATE OR REPLACE VIEW v_bud_repair_success_rate AS
SELECT
  COALESCE(r.agent_id, e.source_agent)                          AS agent_id,
  COUNT(DISTINCT e.id)                                          AS total_repairs,
  COUNT(DISTINCT r.id)                                          AS total_rollbacks,
  ROUND(
    100.0 * (
      1 - COUNT(DISTINCT r.id)::numeric
        / NULLIF(COUNT(DISTINCT e.id), 0)
    ),
    1
  )                                                             AS success_rate_pct
FROM public.bud_repair_executions e
LEFT JOIN public.bud_rollback_events r ON r.execution_id = e.id
WHERE e.created_at > now() - interval '30 days'
GROUP BY COALESCE(r.agent_id, e.source_agent);
