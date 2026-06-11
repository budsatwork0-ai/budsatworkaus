-- 056_efficiency_architect.sql
--
-- Efficiency Architect agent:
--   1. efficiency_findings — structured findings from the agent
--   2. resilience_events   — observable log of zombie reaps, concurrency
--                            blocks, and circuit trips; makes the Resilience
--                            Engine visible in Mission Control
--   3. Seed the agent row in `agents`

-- ── 1. Efficiency findings ───────────────────────────────────────────────────

create table if not exists public.efficiency_findings (
  id                  uuid        primary key default gen_random_uuid(),

  agent_id            text        not null default 'efficiency-architect',
  run_id              text        not null,

  domain              text        not null
                                  check (domain in (
                                    'agent_fleet',
                                    'workflow_redundancy',
                                    'automation_gap',
                                    'operational_throughput'
                                  )),

  title               text        not null,
  body                text,

  severity            text        not null default 'medium'
                                  check (severity in ('low','medium','high','critical')),
  priority            text        not null default 'P2'
                                  check (priority in ('P0','P1','P2','P3')),

  affected_agents     text[]      not null default '{}',
  affected_workflows  text[]      not null default '{}',

  current_cost        text,
  proposed_fix        text,
  estimated_saving    text,

  automation_candidate  boolean   not null default false,
  automation_trigger    text,
  automation_action     text,

  evidence            jsonb,

  status              text        not null default 'new'
                                  check (status in ('new','reviewing','resolved','wont_fix')),
  resolved_at         timestamptz,
  resolution_note     text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists efficiency_findings_severity_idx
  on public.efficiency_findings (severity, priority);

create index if not exists efficiency_findings_domain_idx
  on public.efficiency_findings (domain);

create index if not exists efficiency_findings_created_at_idx
  on public.efficiency_findings (created_at desc);

alter table public.efficiency_findings enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'efficiency_findings' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on public.efficiency_findings
      for all using (true);
  end if;
end $$;

-- ── 2. Resilience events ─────────────────────────────────────────────────────
--
-- Records every time a resilience guard fires so Mission Control can display
-- the three guards (circuit breaker, zombie reaper, concurrency guard) as
-- live operational infrastructure rather than hidden utilities.

create table if not exists public.resilience_events (
  id            bigserial   primary key,
  guard         text        not null
                            check (guard in ('circuit_breaker', 'zombie_reaper', 'concurrency_guard')),
  event_type    text        not null,
  -- guard-specific payload
  -- circuit_breaker: { state, failure_streak, resets_at }
  -- zombie_reaper:   { reaped_count, run_ids }
  -- concurrency_guard: { agent_id, active_run_id, age_minutes }
  payload       jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists resilience_events_guard_idx
  on public.resilience_events (guard, created_at desc);

create index if not exists resilience_events_created_at_idx
  on public.resilience_events (created_at desc);

alter table public.resilience_events enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'resilience_events' and policyname = 'service_role_all'
  ) then
    create policy "service_role_all" on public.resilience_events
      for all using (true);
  end if;
end $$;

-- ── 3. Seed efficiency-architect agent ──────────────────────────────────────

insert into public.agents (
  id,
  name,
  description,
  category,
  autonomy,
  status,
  schedule,
  config
) values (
  'efficiency-architect',
  'Efficiency Architect',
  'Fleet-wide operational efficiency analysis: cost-per-outcome, redundant agents, automation ROI, '
    'workflow redundancy, and throughput bottlenecks.',
  'ops',
  'review',
  'enabled',
  '0 6 * * 0',
  '{}'::jsonb
)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  category    = excluded.category,
  autonomy    = excluded.autonomy,
  status      = excluded.status,
  schedule    = excluded.schedule;
