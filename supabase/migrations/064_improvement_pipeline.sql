-- 064: Autonomous Improvement Pipeline
--
-- Three new tables power the proactive improvement loop that sits alongside
-- the existing bud_repair_executions (reactive) flow:
--
--   bud_improvement_signals   — opportunity signals from Bud Observer and other sources
--   bud_improvement_executions— the execution record for each autonomous improvement run
--   bud_telemetry_events      — post-deploy production health events (anomalies, rollbacks)

-- ── Improvement signals ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bud_improvement_signals (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  source        TEXT        NOT NULL,  -- 'observer'|'ux_proposal'|'design_insight'|'bud_insight'|'manual'
  signal_type   TEXT        NOT NULL,  -- 'ux_friction'|'perf_regression'|'conversion_drop'|'error_spike'|'opportunity'|'design_debt'
  severity      TEXT        NOT NULL DEFAULT 'medium',
  title         TEXT        NOT NULL,
  description   TEXT,
  affected_area TEXT,                  -- page path, agent id, service area, etc.
  proposed_approach TEXT,             -- high-level approach suggested by observer
  reference_files TEXT[],             -- file paths the executor should read
  metadata      JSONB,
  status        TEXT        NOT NULL DEFAULT 'new',  -- 'new'|'queued'|'executing'|'completed'|'rejected'|'stale'
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bud_improvement_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_improvement_signals" ON bud_improvement_signals
  USING (true) WITH CHECK (true);

-- ── Improvement executions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bud_improvement_executions (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  signal_id              UUID        REFERENCES bud_improvement_signals(id) ON DELETE SET NULL,
  -- Mirrors repair_executor fields so the pipeline strip UI can reuse the same component
  status                 TEXT        NOT NULL DEFAULT 'detected',
  trigger                TEXT        NOT NULL DEFAULT 'manual',  -- 'manual'|'cron'|'observer'|'approval'
  title                  TEXT        NOT NULL,
  approach               TEXT,       -- LLM-generated improvement strategy
  diff_summary           TEXT,       -- what was changed and why (populates DIFF phase)
  branch_name            TEXT,
  pr_url                 TEXT,
  issue_url              TEXT,
  confidence             FLOAT,
  risk_score             INTEGER,
  -- CI
  ci_conclusion          TEXT,
  ci_run_url             TEXT,
  ci_workflow_run_id     TEXT,
  verification_status    TEXT,
  -- Taste
  taste_score            FLOAT,
  taste_pass             BOOLEAN,
  taste_violations       JSONB,
  taste_suggestions      JSONB,
  taste_checked_files    JSONB,
  taste_checked_at       TIMESTAMPTZ,
  -- Browser tests
  browser_tests_passed   INTEGER,
  browser_tests_failed   INTEGER,
  browser_tests_total    INTEGER,
  browser_test_status    TEXT,
  -- Auto-merge
  auto_merged            BOOLEAN     DEFAULT FALSE,
  auto_merged_at         TIMESTAMPTZ,
  auto_merge_blocked_reason TEXT,
  -- Rollback
  rollback_reason        TEXT,
  -- Meta
  created_by             TEXT,
  created_at             TIMESTAMPTZ DEFAULT now(),
  updated_at             TIMESTAMPTZ DEFAULT now(),
  finished_at            TIMESTAMPTZ
);

ALTER TABLE bud_improvement_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_improvement_executions" ON bud_improvement_executions
  USING (true) WITH CHECK (true);

-- Improvement execution steps (same shape as bud_repair_steps)
CREATE TABLE IF NOT EXISTS bud_improvement_steps (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id  UUID        NOT NULL REFERENCES bud_improvement_executions(id) ON DELETE CASCADE,
  state         TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'running',  -- 'running'|'passed'|'failed'|'blocked'|'skipped'
  summary       TEXT,
  evidence      JSONB,
  confidence    FLOAT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

ALTER TABLE bud_improvement_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_improvement_steps" ON bud_improvement_steps
  USING (true) WITH CHECK (true);

-- Improvement execution logs (same shape as bud_repair_logs)
CREATE TABLE IF NOT EXISTS bud_improvement_logs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id  UUID        NOT NULL REFERENCES bud_improvement_executions(id) ON DELETE CASCADE,
  step_id       UUID        REFERENCES bud_improvement_steps(id) ON DELETE SET NULL,
  level         TEXT        NOT NULL DEFAULT 'info',
  message       TEXT        NOT NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bud_improvement_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_improvement_logs" ON bud_improvement_logs
  USING (true) WITH CHECK (true);

-- ── Production telemetry events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS bud_telemetry_events (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Which execution triggered this event (improvement or repair)
  improvement_id  UUID        REFERENCES bud_improvement_executions(id) ON DELETE SET NULL,
  repair_id       UUID        REFERENCES bud_repair_executions(id) ON DELETE SET NULL,
  event_type      TEXT        NOT NULL,  -- 'deploy'|'anomaly'|'rollback'|'recovery'|'checkpoint'
  branch_name     TEXT,
  pr_number       INTEGER,
  deployment_url  TEXT,
  -- Metric snapshot
  metric_name     TEXT,                  -- e.g. 'error_rate', 'p95_latency_ms', 'conversion_rate'
  metric_value    FLOAT,
  threshold       FLOAT,                 -- the value that would trigger action
  baseline        FLOAT,                 -- pre-deploy baseline for comparison
  -- Rollback info
  rollback_triggered BOOLEAN DEFAULT FALSE,
  rollback_notes  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bud_telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_telemetry" ON bud_telemetry_events
  USING (true) WITH CHECK (true);

-- ── Improvement learnings ──────────────────────────────────────────────────────
-- Mirror of bud_repair_learnings but for improvements so they can be recalled
-- by future observer/improvement runs.

CREATE TABLE IF NOT EXISTS bud_improvement_learnings (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id    UUID        REFERENCES bud_improvement_executions(id) ON DELETE SET NULL,
  signal_id       UUID        REFERENCES bud_improvement_signals(id) ON DELETE SET NULL,
  memory_doc_id   UUID,                  -- FK to memory_documents (soft ref)
  signal_type     TEXT,
  improvement_pattern TEXT     NOT NULL, -- what was changed and how
  outcome         TEXT        NOT NULL,  -- 'shipped'|'blocked'|'rolled_back'|'draft'
  affected_area   TEXT,
  notes           TEXT,
  embedding       VECTOR(1536),         -- semantic search support
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bud_improvement_learnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all_improvement_learnings" ON bud_improvement_learnings
  USING (true) WITH CHECK (true);

-- Index for semantic similarity search over learnings
CREATE INDEX IF NOT EXISTS bud_improvement_learnings_embedding_idx
  ON bud_improvement_learnings USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

-- ── Updated-at triggers ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_improvement_signals_updated_at
  BEFORE UPDATE ON bud_improvement_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_improvement_executions_updated_at
  BEFORE UPDATE ON bud_improvement_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
