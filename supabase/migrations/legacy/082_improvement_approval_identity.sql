-- Phase 3: stable approval identity for improvement approvals.
-- Protects against duplicate pending Bud approval rows even if a code path
-- reaches queueApproval() directly.

alter table public.bud_approval_queue
  add column if not exists approval_identity text,
  add column if not exists last_seen_at timestamptz;

with candidates as (
  select
    id,
    action_type || ':' ||
      coalesce(
        payload->>'signal_id',
        payload->>'fingerprint',
        payload->>'task_id'
      ) as computed_identity
  from public.bud_approval_queue
  where status = 'pending'
    and action_type = 'run_improvement_pipeline'
    and coalesce(payload->>'signal_id', payload->>'fingerprint', payload->>'task_id') is not null
),
ranked as (
  select
    *,
    row_number() over (partition by computed_identity order by id) as identity_rank
  from candidates
)
update public.bud_approval_queue q
set approval_identity = r.computed_identity
from ranked r
where q.id = r.id
  and r.identity_rank = 1
  and q.approval_identity is null;

create unique index if not exists bud_approval_queue_one_pending_improvement_identity
  on public.bud_approval_queue (approval_identity)
  where approval_identity is not null
    and status = 'pending';
