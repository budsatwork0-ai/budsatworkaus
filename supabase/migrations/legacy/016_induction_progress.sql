-- Add induction_progress column to applicants table to persist step completion state
ALTER TABLE applicants
  ADD COLUMN IF NOT EXISTS induction_progress jsonb DEFAULT '{}'::jsonb;
