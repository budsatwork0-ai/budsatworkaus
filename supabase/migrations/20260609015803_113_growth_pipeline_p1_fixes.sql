-- 113_growth_pipeline_p1_fixes.sql
-- Fixes for Growth Department pipeline blockers identified in runtime audit (2026-06-09).
--
-- Fix 1: content_ideas — add 'approved' to status constraint.
--   The API route triggers script generation on status='approved', but the constraint
--   only allowed: captured | developed | scripted | archived. Setting 'approved' was
--   returning a 23514 constraint violation and silently killing the trigger.
--   New allowed values: captured | developed | approved | scripted | archived
--
-- Fix 2: marketing_publishing_queue — add DB-level unique partial index on production_card_id.
--   The existing app-level idempotency guard (maybeSingle check) is not atomic under
--   concurrent requests. This index makes the duplicate protection absolute at DB level.

-- ── Fix 1: content_ideas status constraint ────────────────────────────────────

ALTER TABLE content_ideas DROP CONSTRAINT IF EXISTS content_ideas_status_check;

ALTER TABLE content_ideas ADD CONSTRAINT content_ideas_status_check
  CHECK (status = ANY (ARRAY[
    'captured'::text,
    'developed'::text,
    'approved'::text,
    'scripted'::text,
    'archived'::text
  ]));

-- ── Fix 2: marketing_publishing_queue unique production_card_id ───────────────

CREATE UNIQUE INDEX IF NOT EXISTS marketing_publishing_queue_card_unique
  ON marketing_publishing_queue(production_card_id)
  WHERE production_card_id IS NOT NULL;
