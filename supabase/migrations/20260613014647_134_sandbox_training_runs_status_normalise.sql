-- Migration 134 — sandbox_training_runs status normalisation (BUG-1 follow-up)
--
-- Problem: sandbox_training_runs.status was originally defined with the
--   lifecycle comment "'running' | 'completed' | 'failed'", but
--   sandbox_run_batches (migration 133) uses 'complete' (no trailing 'd').
--   The drift means any cross-table status filter silently returns wrong results
--   and the column can accumulate values outside the intended lifecycle.
--
-- Fix:
--   1. Normalise all existing 'completed' rows → 'complete'.
--   2. Add a CHECK constraint so the column can only hold the three lifecycle
--      values that match sandbox_run_batches: 'running' | 'complete' | 'failed'.
--
-- Idempotent: UPDATE is a no-op if rows are already normalised;
--             ADD CONSTRAINT is guarded by an existence check.
--
-- Production tables affected: NONE.
-- Only sandbox_training_runs is touched; all rows carry environment='sandbox'.

-- Step 1: normalise existing rows
UPDATE public.sandbox_training_runs
SET    status = 'complete'
WHERE  status = 'completed';

-- Step 2: add CHECK constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   information_schema.table_constraints
    WHERE  table_schema    = 'public'
    AND    table_name      = 'sandbox_training_runs'
    AND    constraint_name = 'sandbox_training_runs_status_check'
  ) THEN
    ALTER TABLE public.sandbox_training_runs
      ADD CONSTRAINT sandbox_training_runs_status_check
      CHECK (status IN ('running', 'complete', 'failed'));
  END IF;
END;
$$;
