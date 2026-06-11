-- ─────────────────────────────────────────────────────────────────────────────
-- 123  Reviewer Safety Guardrails
-- Tightens calibration bounds and adds bad-outcome tracking columns.
-- ─────────────────────────────────────────────────────────────────────────────

-- Tighten score_adjustment: upper bound drops from +20 to +10.
-- Calibration can nudge scores up slightly, but cannot earn unbounded trust.
ALTER TABLE reviewer_calibration
  DROP CONSTRAINT IF EXISTS reviewer_calibration_score_adjustment_check;
ALTER TABLE reviewer_calibration
  ADD  CONSTRAINT reviewer_calibration_score_adjustment_check
    CHECK (score_adjustment BETWEEN -20 AND 10);

-- Clamp existing values that exceed the new upper bound.
UPDATE reviewer_calibration SET score_adjustment = 10 WHERE score_adjustment > 10;

-- Tighten penalty_multiplier: lower bound rises from 0.5 to 1.0, upper drops from 3.0 to 2.5.
-- Calibration cannot reduce caution below baseline (1.0), and cannot make scores collapse (cap 2.5).
ALTER TABLE reviewer_calibration
  DROP CONSTRAINT IF EXISTS reviewer_calibration_penalty_multiplier_check;
ALTER TABLE reviewer_calibration
  ADD  CONSTRAINT reviewer_calibration_penalty_multiplier_check
    CHECK (penalty_multiplier BETWEEN 1.0 AND 2.5);

-- Clamp existing values that fall outside the new range.
UPDATE reviewer_calibration SET penalty_multiplier = 1.0 WHERE penalty_multiplier < 1.0;
UPDATE reviewer_calibration SET penalty_multiplier = 2.5 WHERE penalty_multiplier > 2.5;

-- Track consecutive wrong predictions per system area.
-- When this reaches the HEIGHTENED_CAUTION_THRESHOLD (2), heightened_caution is set true.
-- Recovery is gradual — one correct prediction decrements the streak by 1.
ALTER TABLE reviewer_calibration
  ADD COLUMN IF NOT EXISTS wrong_recommendation_streak integer NOT NULL DEFAULT 0
    CHECK (wrong_recommendation_streak >= 0);

ALTER TABLE reviewer_calibration
  ADD COLUMN IF NOT EXISTS heightened_caution boolean NOT NULL DEFAULT false;
