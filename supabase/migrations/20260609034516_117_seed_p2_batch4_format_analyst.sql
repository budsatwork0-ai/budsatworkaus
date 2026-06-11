-- 117_seed_p2_batch4_format_analyst.sql
-- P2 Batch 4: Format Analyst — weekly learning from published performance data.
--
-- Changes:
--   1. Add performance_data jsonb column to marketing_publishing_queue.
--      Holds manually-entered metrics after publishing (views, likes, shares,
--      saves, reach, comments, watch_time_pct). Null = no data captured yet.
--   2. Seed the format-analyst agent.

-- ── Performance data column ───────────────────────────────────────────────────
-- Example structure:
-- {
--   "views": 1200, "likes": 48, "shares": 15, "saves": 22,
--   "reach": 940, "comments": 4, "watch_time_pct": 0.62
-- }

ALTER TABLE public.marketing_publishing_queue
  ADD COLUMN IF NOT EXISTS performance_data jsonb;

-- ── format-analyst agent seed ─────────────────────────────────────────────────

INSERT INTO agents (id, name, description, category, status, autonomy, schedule, config)
VALUES (
  'format-analyst',
  'Format Analyst',
  'Weekly review — turns published performance data into reusable content learnings.',
  'sales',
  'enabled',
  'review',
  '0 9 * * 5',
  '{"policies": {}}'::jsonb
)
ON CONFLICT (id) DO UPDATE
  SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    category    = EXCLUDED.category,
    status      = EXCLUDED.status,
    autonomy    = EXCLUDED.autonomy,
    schedule    = EXCLUDED.schedule,
    config      = EXCLUDED.config,
    updated_at  = now();
