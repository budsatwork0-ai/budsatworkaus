-- Daily ops query: surface agent runs that produced no output in the last 24 hours.
-- Run this in the Supabase SQL editor or schedule via pg_cron.

SELECT
  agent_id,
  COUNT(*)                          AS suppressed_runs,
  MIN(timestamp)                    AS first_seen,
  MAX(timestamp)                    AS last_seen,
  JSONB_AGG(payload ORDER BY timestamp DESC) FILTER (WHERE ROW_NUMBER() OVER (PARTITION BY agent_id ORDER BY timestamp DESC) <= 5) AS recent_payloads
FROM agent_dead_letters
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY agent_id
ORDER BY suppressed_runs DESC;
