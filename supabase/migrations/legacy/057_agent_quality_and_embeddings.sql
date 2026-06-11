-- 057: Agent quality scores + pgvector semantic search
--
-- 1. quality_score on agent_runs: 0.0–1.0 float updated when actions
--    are approved (quality_score += 0.2 per action, capped at 1.0) or
--    rejected (quality_score -= 0.2 per action, floor 0.0).
--    A run with no actions stays NULL (unscored). The efficiency-architect
--    can use this to identify signal vs. noise agents over time.
--
-- 2. cache token counters on agent_runs: tracks Anthropic prompt-cache
--    savings for cost reporting in Mission Control.
--
-- 3. pgvector extension + summary_embedding on agent_runs: enables
--    semantic search over all agent output summaries. The runtime writes
--    embeddings after each successful run. Requires Supabase pgvector
--    (already available on all hosted projects).

-- ── 1. Quality score ──────────────────────────────────────────────────────────

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS quality_score   float       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_signals jsonb       DEFAULT '[]'::jsonb;

-- Index for surfacing low-quality agents efficiently
CREATE INDEX IF NOT EXISTS idx_agent_runs_quality
  ON agent_runs (agent_id, quality_score)
  WHERE quality_score IS NOT NULL;

-- Trigger function: whenever an agent_action changes to approved/rejected,
-- update the parent run's quality_score.
CREATE OR REPLACE FUNCTION update_run_quality_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_delta       float;
  v_current     float;
  v_new_score   float;
  v_signal      jsonb;
BEGIN
  -- Only act on status transitions to approved or rejected
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN RETURN NEW; END IF;

  v_delta := CASE WHEN NEW.status = 'approved' THEN 0.2 ELSE -0.2 END;

  -- Build a signal record for the audit trail
  v_signal := jsonb_build_object(
    'action_type', NEW.action_type,
    'status',      NEW.status,
    'delta',       v_delta,
    'at',          now()
  );

  -- Read current score (NULL → 0.5 starting point)
  SELECT COALESCE(quality_score, 0.5) INTO v_current
  FROM agent_runs WHERE id = NEW.run_id;

  v_new_score := GREATEST(0.0, LEAST(1.0, v_current + v_delta));

  UPDATE agent_runs
  SET
    quality_score   = v_new_score,
    quality_signals = COALESCE(quality_signals, '[]'::jsonb) || v_signal
  WHERE id = NEW.run_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_action_quality ON agent_actions;
CREATE TRIGGER trg_action_quality
  AFTER UPDATE OF status ON agent_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_run_quality_score();

-- ── 2. Prompt-cache token counters ───────────────────────────────────────────

ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS cache_read_tokens     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_tokens integer DEFAULT 0;

-- View for cache savings reporting: how many tokens (and dollars) the cache
-- saved per agent over the last 30 days.
CREATE OR REPLACE VIEW v_agent_cache_savings AS
SELECT
  agent_id,
  SUM(cache_read_tokens)                                               AS total_cache_reads,
  SUM(cache_creation_tokens)                                           AS total_cache_writes,
  SUM(input_tokens)                                                    AS total_input_tokens,
  -- Read tokens cost ~10% vs full input price; savings = 90% of read price
  ROUND(
    (SUM(cache_read_tokens)::numeric / 1000000) *
    CASE model
      WHEN 'claude-sonnet-4-6'          THEN 3 * 0.9
      WHEN 'claude-haiku-4-5-20251001'  THEN 1 * 0.9
      ELSE 3 * 0.9
    END,
    4
  )                                                                    AS estimated_savings_usd,
  COUNT(*)                                                             AS run_count
FROM agent_runs
WHERE started_at > now() - interval '30 days'
GROUP BY agent_id, model;

-- ── 3. pgvector semantic search ───────────────────────────────────────────────

-- Enable the extension (safe to run on an existing project — no-op if present)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1536-dim column for text-embedding-3-small (OpenAI) or
-- 1024-dim for voyage-3 / Cohere. We default to 1536.
-- Existing rows will have NULL — embeddings are written lazily by the runtime.
ALTER TABLE agent_runs
  ADD COLUMN IF NOT EXISTS summary_embedding vector(1536);

-- IVFFlat index for approximate nearest-neighbour search.
-- Build after at least 100 rows have embeddings (safe to run before then —
-- index creation simply operates on zero rows).
CREATE INDEX IF NOT EXISTS idx_agent_runs_embedding
  ON agent_runs
  USING ivfflat (summary_embedding vector_cosine_ops)
  WITH (lists = 50);

-- Convenience RPC: semantic search over run summaries.
-- Usage: SELECT * FROM search_agent_runs('[0.1, 0.2, ...]'::vector, 10);
CREATE OR REPLACE FUNCTION search_agent_runs(
  query_embedding vector(1536),
  match_count     int DEFAULT 10
)
RETURNS TABLE (
  run_id      uuid,
  agent_id    text,
  summary     text,
  started_at  timestamptz,
  similarity  float
) LANGUAGE sql STABLE AS $$
  SELECT
    id             AS run_id,
    agent_id,
    summary,
    started_at,
    1 - (summary_embedding <=> query_embedding) AS similarity
  FROM agent_runs
  WHERE summary_embedding IS NOT NULL
  ORDER BY summary_embedding <=> query_embedding
  LIMIT match_count;
$$;
