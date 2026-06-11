-- Allow 'stale' as a valid status for bud_change_requests.
-- The orchestrator marks a CR stale when its branch no longer exists on GitHub,
-- so the dedup check doesn't block future repair attempts indefinitely.

alter table public.bud_change_requests
  drop constraint if exists bud_change_requests_status_check;

alter table public.bud_change_requests
  add constraint bud_change_requests_status_check
  check (status in ('open', 'merged', 'closed', 'deployed', 'stale'));
