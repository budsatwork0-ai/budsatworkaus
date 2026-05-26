-- Archive stale blocked/failed repair tasks that were causing a permanent
-- repairing/critical state in Mission Control. These repairs had no evidence
-- (no diff, no test output, no deployment record) and cannot be actioned.

-- 1. Archive blocked/failed bud_tasks so the health engine no longer counts
--    them as blockedRepairs (page.tsx excludes 'archived' from its status filter).
update public.bud_tasks
set
  status     = 'archived',
  updated_at = now()
where status in ('blocked', 'failed');

-- 2. Reset bud_lobby_states: retire the current record and insert a clean one.
--    The cron job will re-evaluate and update this on its next run.
update public.bud_lobby_states
set is_current = false
where is_current = true;

insert into public.bud_lobby_states
  (bud_state, operational_status, summary, sections, workflows, kpis, agent_states, is_current)
values
  (
    'idle',
    'nominal',
    'Stale repair tasks archived. System reset to monitoring mode.',
    '[]',
    '[]',
    '{}',
    '{}',
    true
  );
