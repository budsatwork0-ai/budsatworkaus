-- =====================================================================
-- Migration 086: agent_alerts
-- Creates the table that flagForReviewEffect inserts into when a
-- flag_for_review / ux_fix_required action is approved.
-- =====================================================================

create table if not exists public.agent_alerts (
  id            uuid primary key default gen_random_uuid(),
  action_id     uuid references public.agent_actions(id) on delete set null,
  agent_id      text,
  source_agent  text,
  severity      text,
  title         text,
  message       text,
  payload       jsonb not null default '{}'::jsonb,
  status        text not null default 'open' check (status in ('open','resolved','ignored')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

-- Prevent double-insert if the same action is approved twice.
create unique index if not exists idx_agent_alerts_action_id
  on public.agent_alerts(action_id)
  where action_id is not null;

create index if not exists idx_agent_alerts_status
  on public.agent_alerts(status);
create index if not exists idx_agent_alerts_agent_id
  on public.agent_alerts(agent_id);
create index if not exists idx_agent_alerts_source_agent
  on public.agent_alerts(source_agent);
create index if not exists idx_agent_alerts_created_at
  on public.agent_alerts(created_at desc);

-- Allow the service role (used by the runtime) full access.
alter table public.agent_alerts enable row level security;

create policy "service role full access" on public.agent_alerts
  as permissive for all to service_role using (true) with check (true);
