-- 055_agent_resilience.sql
--
-- Resilience Engine: circuit breaker state for external services.
-- One row per monitored service (starts with 'anthropic_api').
-- The runtime reads this before every LLM call to gate on API health.

create table if not exists public.bud_circuit_states (
  id                text        primary key,
  state             text        not null default 'closed'
                                check (state in ('closed', 'open', 'half_open')),
  failure_streak    integer     not null default 0,
  probe_successes   integer     not null default 0,
  last_failure_at   timestamptz,
  last_success_at   timestamptz,
  opens_at          timestamptz,
  resets_at         timestamptz,
  updated_at        timestamptz not null default now()
);

alter table public.bud_circuit_states enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'bud_circuit_states' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on public.bud_circuit_states
      for all using (true);
  end if;
end $$;

-- Seed the Anthropic API circuit in closed state
insert into public.bud_circuit_states (id, state)
values ('anthropic_api', 'closed')
on conflict (id) do nothing;
