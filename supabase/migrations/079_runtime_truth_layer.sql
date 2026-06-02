-- =====================================================================
-- Migration 079: Runtime truth layer repair
-- =====================================================================
-- Tightens Mission Control's approval source of truth:
--   - v_pending_agent_actions exposes the target fields used by Bud OS buttons.
--   - pending agent actions are unique per agent/action/target to stop duplicate
--     approval rows during repeated cron/manual runs.
-- =====================================================================

drop view if exists public.v_pending_agent_actions cascade;

create view public.v_pending_agent_actions as
select
  a.id              as action_id,
  a.run_id,
  a.agent_id,
  ag.name           as agent_name,
  a.action_type,
  a.target_table,
  a.target_id,
  a.preview,
  a.payload,
  a.requires_approval,
  a.status,
  a.created_at
from public.agent_actions a
join public.agents ag on ag.id = a.agent_id
where a.status = 'pending'
order by a.created_at desc;

create unique index if not exists agent_actions_one_pending_per_target
  on public.agent_actions (agent_id, action_type, target_table, target_id)
  where status = 'pending'
    and target_table is not null
    and target_id is not null;
