-- =====================================================================
-- Migration 143: Agent stale_after_minutes
-- =====================================================================
-- Adds a schedule-aware staleness threshold to each agent.
-- NULL = no schedule expectation (manual-only agents).
-- Non-null = number of minutes after last_run_at before the agent is
-- considered stale. Values are set to 2× the cron interval for
-- sub-daily schedules, and interval + 10% buffer for weekly schedules.
--
-- Updates v_agent_runtime_status to expose is_stale as a derived bool.
-- =====================================================================

alter table public.agents
  add column if not exists stale_after_minutes integer;

-- Sub-hourly agents
update public.agents set stale_after_minutes = 60  where id = 'quote-triage';    -- */15 → 60 min
update public.agents set stale_after_minutes = 90  where id = 'customer-reply';  -- */30 → 90 min

-- Hourly agents
update public.agents set stale_after_minutes = 180 where id = 'lead-scorer';     -- 5 * * * * → 3h

-- Multi-hour agents
update public.agents set stale_after_minutes = 360 where id = 'bud-observer';    -- */4h → 6h
update public.agents set stale_after_minutes = 480 where id = 'bud';             -- */6h → 8h

-- Daily agents (run once per day — stale after 26h)
update public.agents set stale_after_minutes = 1560 where id in (
  'analytics-intelligence',
  'admin-optimization',
  'ux-intelligence',
  'scheduling',
  'reconciliation',
  'field-producer',
  'reviews',
  'competitor-watcher',
  'trend-scout',
  'adaptation-validator',
  'thread-progress',
  'production-monitor',
  'asset-matcher'
);

-- Weekly agents (run once per week — stale after 7.5 days = 10800 min)
update public.agents set stale_after_minutes = 10800 where id in (
  'price-optimizer',
  'github-historian',
  'design-system',
  'whs-safety-reminder',
  'cash-flow-forecaster',
  'lapsed-win-back',
  'seo-meta',
  'competitor-scout',
  'arc-monitor',
  'consent-monitor',
  'campaign-reporter',
  'cadence-monitor',
  'format-analyst'
);

-- =====================================================================
-- Rebuild v_agent_runtime_status to add is_stale
-- New columns (stale_after_minutes, is_stale) appended at the end so
-- CREATE OR REPLACE is valid — existing column positions are preserved.
-- =====================================================================
create or replace view public.v_agent_runtime_status as
select
  a.id                                       as agent_id,
  latest.status                              as last_run_outcome,
  coalesce(stats.runs_30d, 0)::bigint        as runs_30d,
  a.stale_after_minutes,
  case
    when a.stale_after_minutes is null then false
    when a.last_run_at is null          then true
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
