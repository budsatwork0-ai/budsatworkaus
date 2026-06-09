-- Seed P2 Batch 2 agents: Asset Matcher + Consent Monitor.
-- Both are deterministic review-only agents (no LLM calls, costCents: 0).
-- They run on Vercel cron and write to growth_pipeline_events.

INSERT INTO agents (id, name, description, category, status, autonomy, schedule, config)
VALUES
  (
    'asset-matcher',
    'Asset Matcher',
    'Daily review — suggests confirmed cleared assets for active production cards.',
    'sales',
    'enabled',
    'review',
    '0 7 * * *',
    '{"policies": {}}'::jsonb
  ),
  (
    'consent-monitor',
    'Consent Monitor',
    'Weekly review — flags assets with pending/unknown consent older than 7 days.',
    'compliance',
    'enabled',
    'review',
    '15 7 * * 2',
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
