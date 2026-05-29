-- 042_agent_guardrails.sql
--
-- Adds an `agent_guardrail_events` table that the failproofai-style
-- policy runner writes to whenever a policy returns `warn`, `modify`,
-- or `block`. The runtime is tolerant of this table being missing
-- (it swallows "relation does not exist") so this migration is safe
-- to apply any time after the agents system is up.

create table if not exists public.agent_guardrail_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  agent_id text not null references public.agents(id) on delete cascade,
  policy_id text not null,
  hook text not null,
  verdict text not null check (verdict in ('warn', 'modify', 'block', 'allow')),
  reason text,
  lineage_depth integer not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists agent_guardrail_events_run_id_idx
  on public.agent_guardrail_events (run_id);
create index if not exists agent_guardrail_events_agent_id_created_at_idx
  on public.agent_guardrail_events (agent_id, created_at desc);
create index if not exists agent_guardrail_events_policy_id_idx
  on public.agent_guardrail_events (policy_id);

alter table public.agent_guardrail_events enable row level security;

-- Admin-only read; service role bypasses RLS for inserts.
drop policy if exists "Admins read guardrail events" on public.agent_guardrail_events;
create policy "Admins read guardrail events"
  on public.agent_guardrail_events
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );
