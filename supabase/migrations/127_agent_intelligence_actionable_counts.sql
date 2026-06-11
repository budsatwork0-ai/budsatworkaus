-- Agent Intelligence v2: count only actionable approval work in initiative metrics.

update public.bud_root_cause_initiatives i
set approval_count = coalesce(a.approval_count, 0) + coalesce(q.approval_count, 0)
from (
  select root_cause_key, count(*)::integer as approval_count
  from public.agent_actions
  where status = 'pending'
    and coalesce(is_duplicate, false) = false
  group by root_cause_key
) a
full join (
  select root_cause_key, count(*)::integer as approval_count
  from public.v_bud_approval_truth
  where truth_label in ('Actionable', 'Needs manual review')
    and coalesce(is_duplicate, false) = false
  group by root_cause_key
) q on q.root_cause_key = a.root_cause_key
where i.root_cause_key = coalesce(a.root_cause_key, q.root_cause_key);

update public.bud_root_cause_initiatives i
set approval_count = 0
where not exists (
  select 1
  from public.agent_actions a
  where a.root_cause_key = i.root_cause_key
    and a.status = 'pending'
    and coalesce(a.is_duplicate, false) = false
)
and not exists (
  select 1
  from public.v_bud_approval_truth q
  where q.root_cause_key = i.root_cause_key
    and q.truth_label in ('Actionable', 'Needs manual review')
    and coalesce(q.is_duplicate, false) = false
);

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
      select count(*) from public.v_pending_agent_actions
    )::integer
    +
    (
      select count(*) from public.v_bud_approval_truth
      where truth_label in ('Actionable', 'Needs manual review')
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
