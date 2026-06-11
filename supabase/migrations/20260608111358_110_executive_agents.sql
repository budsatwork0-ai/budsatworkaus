-- ============================================================
-- 110_executive_agents.sql
-- Executive Agent Layer — 7 tables
-- ============================================================

-- 1. executive_decisions
--    One row per decision produced by a CEO/COO/CMO/CFO run.
create table if not exists executive_decisions (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null,          -- e.g. 'ceo-agent'
  run_id          uuid,                   -- foreign key into agent_runs (soft ref)
  title           text not null,
  reasoning       text not null,
  evidence        jsonb not null default '[]',
  confidence      numeric(4,3) not null check (confidence between 0 and 1),
  risk_level      text not null check (risk_level in ('low', 'medium', 'high')),
  expected_impact text not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected', 'executed', 'deferred')),
  executed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists executive_decisions_agent_id_idx  on executive_decisions (agent_id);
create index if not exists executive_decisions_status_idx    on executive_decisions (status);
create index if not exists executive_decisions_created_at_idx on executive_decisions (created_at desc);

-- 2. executive_tasks
--    Tasks that Chief of Staff distils from executive decisions and routes to the fleet.
create table if not exists executive_tasks (
  id              uuid primary key default gen_random_uuid(),
  decision_id     uuid references executive_decisions (id) on delete cascade,
  source_agent_id text not null,          -- which executive raised this
  target_agent_id text,                   -- which fleet agent should execute
  title           text not null,
  description     text not null,
  priority        text not null default 'normal'
                    check (priority in ('critical', 'high', 'normal', 'low')),
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  due_at          timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists executive_tasks_status_idx      on executive_tasks (status);
create index if not exists executive_tasks_decision_id_idx on executive_tasks (decision_id);

-- 3. executive_metrics_snapshots
--    Point-in-time metric snapshots captured at each CEO run.
create table if not exists executive_metrics_snapshots (
  id              uuid primary key default gen_random_uuid(),
  captured_at     timestamptz not null default now(),
  revenue_7d_aud  numeric(12,2),
  jobs_7d         integer,
  leads_7d        integer,
  conversion_rate numeric(5,4),
  avg_job_value   numeric(10,2),
  cash_position   numeric(12,2),
  crew_utilisation numeric(5,4),
  raw             jsonb not null default '{}'
);

create index if not exists executive_metrics_snapshots_captured_at_idx
  on executive_metrics_snapshots (captured_at desc);

-- 4. executive_weekly_reviews
--    Structured weekly review doc produced by the weekly-learning cron.
create table if not exists executive_weekly_reviews (
  id              uuid primary key default gen_random_uuid(),
  week_start      date not null,
  summary         text not null,
  wins            jsonb not null default '[]',
  risks           jsonb not null default '[]',
  priorities      jsonb not null default '[]',
  agent_learnings jsonb not null default '[]',  -- per-agent insights from the week
  created_at      timestamptz not null default now()
);

create unique index if not exists executive_weekly_reviews_week_start_uidx
  on executive_weekly_reviews (week_start);

-- 5. executive_kpi_targets
--    Targets the CEO/CFO can set; COO/CMO track progress against them.
create table if not exists executive_kpi_targets (
  id          uuid primary key default gen_random_uuid(),
  kpi_key     text not null unique,       -- e.g. 'revenue_weekly_aud', 'crew_utilisation'
  label       text not null,
  target      numeric(14,4) not null,
  unit        text not null default 'number', -- 'aud', 'percent', 'count', 'number'
  owner       text not null,              -- agent_id of the owner e.g. 'cfo-agent'
  active      boolean not null default true,
  set_at      timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 6. executive_directives
--    Long-running strategic directives the CEO issues (multi-week focus areas).
create table if not exists executive_directives (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text not null,
  issued_by    text not null default 'ceo-agent',
  status       text not null default 'active'
                 check (status in ('active', 'completed', 'cancelled')),
  target_date  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists executive_directives_status_idx on executive_directives (status);

-- 7. executive_agent_runs_meta
--    Lightweight metadata table linking agent_runs rows to executive context.
--    Lets us query "all executive runs this week" without a full agent_runs scan.
create table if not exists executive_agent_runs_meta (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null,              -- mirrors agent_runs.id
  agent_id    text not null,
  decisions   integer not null default 0,
  tasks       integer not null default 0,
  auto_executed integer not null default 0,
  queued_approvals integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists executive_agent_runs_meta_agent_id_idx
  on executive_agent_runs_meta (agent_id);
create index if not exists executive_agent_runs_meta_created_at_idx
  on executive_agent_runs_meta (created_at desc);

-- ============================================================
-- Row Level Security — service role only (matches all other tables in this project)
-- ============================================================
alter table public.executive_decisions         enable row level security;
alter table public.executive_tasks             enable row level security;
alter table public.executive_metrics_snapshots enable row level security;
alter table public.executive_weekly_reviews    enable row level security;
alter table public.executive_kpi_targets       enable row level security;
alter table public.executive_directives        enable row level security;
alter table public.executive_agent_runs_meta   enable row level security;

create policy "Service role full access to executive_decisions"
  on public.executive_decisions using (true) with check (true);
create policy "Service role full access to executive_tasks"
  on public.executive_tasks using (true) with check (true);
create policy "Service role full access to executive_metrics_snapshots"
  on public.executive_metrics_snapshots using (true) with check (true);
create policy "Service role full access to executive_weekly_reviews"
  on public.executive_weekly_reviews using (true) with check (true);
create policy "Service role full access to executive_kpi_targets"
  on public.executive_kpi_targets using (true) with check (true);
create policy "Service role full access to executive_directives"
  on public.executive_directives using (true) with check (true);
create policy "Service role full access to executive_agent_runs_meta"
  on public.executive_agent_runs_meta using (true) with check (true);

-- ============================================================
-- updated_at triggers (reuse public.set_updated_at defined in 037_agents.sql)
-- ============================================================
drop trigger if exists trg_exec_decisions_updated_at on public.executive_decisions;
create trigger trg_exec_decisions_updated_at
  before update on public.executive_decisions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_exec_tasks_updated_at on public.executive_tasks;
create trigger trg_exec_tasks_updated_at
  before update on public.executive_tasks
  for each row execute function public.set_updated_at();

drop trigger if exists trg_exec_kpi_targets_updated_at on public.executive_kpi_targets;
create trigger trg_exec_kpi_targets_updated_at
  before update on public.executive_kpi_targets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_exec_directives_updated_at on public.executive_directives;
create trigger trg_exec_directives_updated_at
  before update on public.executive_directives
  for each row execute function public.set_updated_at();
