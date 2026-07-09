-- =====================================================================
-- Migration 142: Agent Runtime Status View
-- =====================================================================
-- Provides per-agent runtime truth: last run outcome and 30-day run count.
-- Used by Mission Control fleet view to surface agents that are failing
-- or have never executed despite being registered.
-- =====================================================================

create or replace view public.v_agent_runtime_status as
select
  a.id as agent_id,
  latest.status as last_run_outcome,
  coalesce(stats.runs_30d, 0)::bigint as runs_30d
from public.agents a
left join (
  select distinct on (agent_id)
    agent_id,
    status
  from public.agent_runs
  where finished_at is not null
  order by agent_id, finished_at desc
) latest on latest.agent_id = a.id
left join (
  select
    agent_id,
    count(*) as runs_30d
  from public.agent_runs
  where started_at >= now() - interval '30 days'
  group by agent_id
) stats on stats.agent_id = a.id;
