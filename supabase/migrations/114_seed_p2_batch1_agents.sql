-- Seed P2 Batch 1 staleness monitor agents.
-- These are deterministic review-only agents (no LLM calls, costCents: 0).
-- They run on Vercel cron and write to growth_pipeline_events.

INSERT INTO agents (id, name, description, category, status, autonomy, schedule, config)
VALUES
  (
    'arc-monitor',
    'Arc Monitor',
    'Weekly review — flags story arcs with no activity in 14+ days.',
    'sales',
    'enabled',
    'review',
    '0 6 * * 1',
    '{"policies": {}}'::jsonb
  ),
  (
    'thread-progress',
    'Thread Progress',
    'Daily review — flags open story threads with no progress in 7+ days.',
    'sales',
    'enabled',
    'review',
    '30 6 * * *',
    '{"policies": {}}'::jsonb
  ),
  (
    'production-monitor',
    'Production Monitor',
    'Daily review — flags production cards stalled for 7+ days.',
    'sales',
    'enabled',
    'review',
    '45 6 * * *',
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
