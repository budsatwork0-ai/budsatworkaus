-- ─────────────────────────────────────────────────────────────────────────────
-- 122  Production Learning Loop — PR review prediction tracking and calibration
-- ─────────────────────────────────────────────────────────────────────────────

-- Stores one record per Agent Reviewer report generated for an open PR.
-- Tracks the prediction made, the actual outcome after merge, and the
-- accuracy verdict so the reviewer can learn from its recommendations.

CREATE TABLE IF NOT EXISTS pr_review_predictions (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  pr_number                 integer     NOT NULL,
  branch                    text        NOT NULL,
  plain_title               text        NOT NULL,
  system_area               text        NOT NULL,
  risk_level                text        NOT NULL
    CHECK (risk_level IN ('low', 'medium', 'high')),
  recommendation            text        NOT NULL
    CHECK (recommendation IN ('approve', 'hold', 'reject', 'needs_manual_review')),
  recommendation_score      integer     NOT NULL CHECK (recommendation_score BETWEEN 0 AND 100),
  evidence_confidence       text        NOT NULL
    CHECK (evidence_confidence IN ('strong', 'partial', 'weak', 'insufficient')),
  evidence_confidence_score integer     NOT NULL CHECK (evidence_confidence_score BETWEEN 0 AND 100),
  evidence_penalty          integer     NOT NULL DEFAULT 0,
  predicted_outcome         text        NOT NULL,    -- summary sentence
  expected_best_case        text,
  expected_outcome          text,
  expected_worst_case       text,
  business_impact           jsonb,                  -- {revenue, customer, operational, agentQuality, reliability}
  -- Post-merge reality
  check_status              text        NOT NULL DEFAULT 'pending'
    CHECK (check_status IN ('pending', 'merged_unchecked', 'confirmed', 'skipped', 'not_merged')),
  merged_at                 timestamptz,
  deployment_succeeded      boolean,
  production_healthy        boolean,
  errors_increased          boolean,
  workflow_affected         boolean,
  rollback_needed           boolean,
  improvement_happened      boolean,
  outcome_notes             text,
  -- Accuracy verdict
  accuracy_verdict          text
    CHECK (accuracy_verdict IN ('correct', 'partially_correct', 'wrong', 'unknown')),
  accuracy_score            integer     CHECK (accuracy_score BETWEEN 0 AND 100),
  learning_notes            jsonb,                  -- {whatGotRight, whatMissed, calibrationNote}
  checked_at                timestamptz,
  created_at                timestamptz DEFAULT now()
);

-- One record per system area, updated as accuracy data accumulates.
-- score_adjustment: applied to the recommendation quality score for this area (+/-)
-- penalty_multiplier: multiplier on the evidence score penalty (>1 = more cautious)
CREATE TABLE IF NOT EXISTS reviewer_calibration (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  system_area           text        NOT NULL UNIQUE,
  score_adjustment      integer     NOT NULL DEFAULT 0
    CHECK (score_adjustment BETWEEN -20 AND 20),
  penalty_multiplier    numeric(4,2) NOT NULL DEFAULT 1.0
    CHECK (penalty_multiplier BETWEEN 0.5 AND 3.0),
  total_predictions     integer     NOT NULL DEFAULT 0,
  correct_predictions   integer     NOT NULL DEFAULT 0,
  accuracy_rate         numeric(5,2),
  last_updated          timestamptz DEFAULT now(),
  calibration_note      text
);

-- Seed one row per system area so evidence route can always find a row
INSERT INTO reviewer_calibration (system_area) VALUES
  ('agent_quality'),
  ('monitoring'),
  ('quote_funnel'),
  ('dashboard_ui'),
  ('infrastructure'),
  ('customer_experience')
ON CONFLICT (system_area) DO NOTHING;

-- Fast lookups by pr_number and check_status
CREATE INDEX IF NOT EXISTS idx_pr_review_predictions_pr_number
  ON pr_review_predictions (pr_number);
CREATE INDEX IF NOT EXISTS idx_pr_review_predictions_check_status
  ON pr_review_predictions (check_status);
CREATE INDEX IF NOT EXISTS idx_pr_review_predictions_created_at
  ON pr_review_predictions (created_at DESC);

-- RLS: only service role (API routes) can read/write
ALTER TABLE pr_review_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewer_calibration   ENABLE ROW LEVEL SECURITY;
