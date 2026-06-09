-- Seed P2 Batch 3 agents: Campaign Reporter + Cadence Monitor.
-- Both are deterministic review-only agents (no LLM calls, costCents: 0).
-- They run on Vercel cron and write to growth_pipeline_events.

INSERT INTO agents (id, name, description, category, status, autonomy, schedule, config)
VALUES
  (
    'campaign-reporter',
    'Campaign Reporter',
    'Weekly review — compares active campaign KPIs against published output.',
    'sales',
    'enabled',
    'review',
    '0 8 * * 1',
    '{"policies": {}}'::jsonb
  ),
  (
    'cadence-monitor',
    'Cadence Monitor',
    'Weekly review — flags channels behind their posting cadence target.',
    'sales',
    'enabled',
    'review',
    '0 7 * * 3',
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
