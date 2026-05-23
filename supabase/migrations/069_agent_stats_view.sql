-- 069: Agent stats view
--
-- Aggregates agent_runs for the last 7 days into one row per agent.
-- Replaces the unbounded per-row query + JS aggregation loop in Mission Control.

CREATE OR REPLACE VIEW public.v_agent_stats_7d AS
SELECT
  agent_id,
  count(*)::int                                                          AS runs,
  count(*) FILTER (WHERE status = 'succeeded')::int                     AS successes,
  count(*) FILTER (WHERE status = 'failed')::int                        AS failures,
  coalesce(sum(cost_cents), 0)::int                                     AS cost_cents,
  coalesce(
    round(avg(duration_ms) FILTER (WHERE duration_ms IS NOT NULL))::int,
    0
  )                                                                      AS avg_duration_ms
FROM public.agent_runs
WHERE started_at >= now() - interval '7 days'
  AND agent_id IS NOT NULL
GROUP BY agent_id;
