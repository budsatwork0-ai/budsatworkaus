-- Bud OS approval cleanup support.
-- Adds archival/blocking states and a truth view so Mission Control can separate
-- live decisions from historical unsafe approval records.

alter table public.bud_approval_queue
  drop constraint if exists bud_approval_queue_status_check;

alter table public.bud_approval_queue
  add constraint bud_approval_queue_status_check
  check (status in ('pending','approved','rejected','archived','blocked'));

alter table public.bud_approval_queue
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists blocked_reason text;

create index if not exists bud_approval_queue_status_created_at_idx
  on public.bud_approval_queue (status, created_at desc);

create index if not exists bud_approval_queue_archived_at_idx
  on public.bud_approval_queue (archived_at desc)
  where status = 'archived';

create or replace view public.v_bud_approval_truth as
select
  q.id,
  q.task_id,
  q.action_type,
  q.status,
  q.created_at,
  q.archived_at,
  q.archive_reason,
  q.blocked_reason,
  t.status as task_status,
  t.risk_level,
  t.linked_pr,
  case
    when q.status = 'archived' then 'Archived'
    when q.status = 'blocked' then 'Blocked'
    when q.status <> 'pending' then 'Archived'
    when q.created_at < now() - interval '24 hours'
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
      then 'Blocked'
    when t.risk_level in ('high', 'critical')
      and coalesce(t.linked_pr, '') = ''
      and coalesce(q.payload->>'pr_url', '') = ''
      and coalesce(q.payload->>'pull_request_url', '') = ''
      and coalesce(q.payload->>'diff', '') = ''
      and coalesce(q.payload->>'diff_summary', '') = ''
      and coalesce(q.payload->>'patch', '') = ''
      then 'Needs manual review'
    else 'Actionable'
  end as truth_label
from public.bud_approval_queue q
left join public.bud_tasks t on t.id = q.task_id;

comment on view public.v_bud_approval_truth is
  'Classifies Bud approvals as Actionable, Blocked, Archived, or Needs manual review without hiding historical failures.';
