-- Phase 11 security triage: lock down static agent workflow membership metadata.
-- The table is seeded from code and queried by internal operational views only.

alter table public.agent_workflow_memberships enable row level security;

drop policy if exists "Admins read agent workflow memberships" on public.agent_workflow_memberships;
create policy "Admins read agent workflow memberships"
  on public.agent_workflow_memberships
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

drop policy if exists "Service role manages agent workflow memberships" on public.agent_workflow_memberships;
create policy "Service role manages agent workflow memberships"
  on public.agent_workflow_memberships
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
