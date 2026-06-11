-- Agent Intelligence v2: keep Mission Control metrics focused on operator-visible initiatives.

create or replace view public.v_agent_intelligence_quality as
with signal_stats as (
  select
    count(*)::integer as signal_count,
    count(distinct coalesce(root_cause_key, fingerprint, id::text))::integer as root_cause_count
  from public.bud_improvement_signals
  where status in ('new', 'queued', 'executing')
),
approval_stats as (
  select
    (
      select count(*) from public.agent_actions
      where status = 'pending'
        and coalesce(is_duplicate, false) = false
    )::integer
    +
    (
      select count(*) from public.bud_approval_queue
      where status = 'pending'
        and coalesce(is_duplicate, false) = false
    )::integer as approval_count
),
initiative_stats as (
  select count(*)::integer as initiative_count
  from public.bud_root_cause_initiatives
  where status in ('open', 'patching', 'validating', 'blocked')
    and approval_count > 0
)
select
  signal_stats.signal_count,
  case
    when signal_stats.signal_count = 0 then 0::numeric
    else round(
      ((signal_stats.signal_count - signal_stats.root_cause_count)::numeric / signal_stats.signal_count::numeric),
      4
    )
  end as duplicate_rate,
  signal_stats.root_cause_count,
  approval_stats.approval_count,
  initiative_stats.initiative_count
from signal_stats, approval_stats, initiative_stats;
