-- =====================================================================
-- Migration 146: Suppress is_stale for disabled/planned agents
-- =====================================================================
-- disabled and planned agents are intentionally not running.
-- Flagging them as stale creates amber noise in the Mission Control
-- fleet view. This migration short-circuits the staleness check for
-- those statuses so only enabled agents can be flagged stale.
--
-- Column list and types are unchanged; only the is_stale CASE changes.
-- =====================================================================

create or replace view public.v_agent_runtime_status as
select
  a.id                                       as agent_id,
  latest.status                              as last_run_outcome,
  coalesce(stats.runs_30d, 0)::bigint        as runs_30d,
  a.stale_after_minutes,
  case
    when a.status in ('disabled', 'planned') then false
    when a.stale_after_minutes is null       then false
    when a.last_run_at is null               then true
    when a.last_run_at < now() - (a.stale_after_minutes || ' minutes')::interval then true
    else false
  end                                        as is_stale
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
