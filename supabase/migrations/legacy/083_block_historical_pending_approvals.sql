-- Phase 4: mark historical blocked approvals as blocked.
-- This preserves audit history and removes non-actionable historical rows from
-- status='pending' without touching Actionable or Needs manual review approvals.

alter table public.bud_approval_queue
  add column if not exists blocked_at timestamptz;

with blocked_candidates as (
  select
    q.id,
    case
      when t.status in ('archived', 'completed')
        then 'Blocked historical approval: linked task is ' || t.status || '.'
      else 'Blocked historical approval: stale high-risk approval without PR, diff, patch, or linked pull request proof.'
    end as reason
  from public.bud_approval_queue q
  left join public.bud_tasks t on t.id = q.task_id
  where q.status = 'pending'
    and q.created_at < now() - interval '24 hours'
    and (
      t.status in ('archived', 'completed')
      or (
        t.risk_level in ('high', 'critical')
        and coalesce(t.linked_pr, '') = ''
        and coalesce(q.payload->>'pr_url', '') = ''
        and coalesce(q.payload->>'pull_request_url', '') = ''
        and coalesce(q.payload->>'diff', '') = ''
        and coalesce(q.payload->>'diff_summary', '') = ''
        and coalesce(q.payload->>'patch', '') = ''
      )
    )
)
update public.bud_approval_queue q
set
  status = 'blocked',
  blocked_at = coalesce(q.blocked_at, now()),
  blocked_reason = coalesce(q.blocked_reason, blocked_candidates.reason)
from blocked_candidates
where q.id = blocked_candidates.id
  and q.status = 'pending';
