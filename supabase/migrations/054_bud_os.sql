-- 054_bud_os.sql
--
-- Bud OS: evidence-backed autonomous operations runtime.
-- Adds durable repair execution, verification, terminal, and learning records.

-- Expand Bud task states from shallow status labels to a real recovery lifecycle.
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.bud_tasks'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.bud_tasks drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.bud_tasks
  add constraint bud_tasks_status_check
  check (status in (
    'pending',
    'detected',
    'reproducing',
    'analyzing',
    'planning',
    'awaiting_approval',
    'patching',
    'validating',
    'deploying',
    'verifying',
    'monitoring',
    'recovered',
    'rolled_back',
    'blocked',
    'in_progress',
    'completed',
    'failed',
    'archived'
  ));

create table if not exists public.bud_repair_executions (
  id                  uuid        primary key default gen_random_uuid(),
  task_id              uuid        references public.bud_tasks(id) on delete cascade,
  source_agent         text,
  trigger              text        not null default 'manual'
                                      check (trigger in ('manual','detected','cron','approval','terminal')),
  status               text        not null default 'detected'
                                      check (status in (
                                        'detected','reproducing','analyzing','planning',
                                        'awaiting_approval','patching','validating',
                                        'deploying','verifying','monitoring','recovered',
                                        'rolled_back','blocked','failed'
                                      )),
  root_cause_type      text,
  root_cause_summary   text,
  repair_strategy      jsonb       not null default '{}',
  risk_score           numeric(5,2) not null default 50 check (risk_score between 0 and 100),
  confidence           numeric(4,3) check (confidence between 0 and 1),
  branch_name          text,
  commit_sha           text,
  diff_summary         text,
  pr_url               text,
  deployment_url       text,
  verification_status  text        not null default 'not_started'
                                      check (verification_status in ('not_started','running','passed','failed','blocked')),
  rollback_trace       jsonb       not null default '{}',
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  created_by           uuid        references auth.users(id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists bud_repair_executions_task_idx
  on public.bud_repair_executions (task_id, created_at desc);
create index if not exists bud_repair_executions_status_idx
  on public.bud_repair_executions (status);

create table if not exists public.bud_repair_steps (
  id            uuid        primary key default gen_random_uuid(),
  execution_id  uuid        not null references public.bud_repair_executions(id) on delete cascade,
  state         text        not null check (state in (
                  'detected','reproducing','analyzing','planning',
                  'awaiting_approval','patching','validating',
                  'deploying','verifying','monitoring','recovered',
                  'rolled_back','blocked','failed'
                )),
  status        text        not null default 'running'
                              check (status in ('running','passed','failed','blocked','skipped')),
  summary       text        not null,
  evidence      jsonb       not null default '{}',
  confidence    numeric(4,3) check (confidence between 0 and 1),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists bud_repair_steps_execution_idx
  on public.bud_repair_steps (execution_id, started_at);

create table if not exists public.bud_repair_logs (
  id            bigserial   primary key,
  execution_id  uuid        not null references public.bud_repair_executions(id) on delete cascade,
  step_id       uuid        references public.bud_repair_steps(id) on delete set null,
  level         text        not null default 'info' check (level in ('debug','info','warn','error')),
  message       text        not null,
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);

create index if not exists bud_repair_logs_execution_idx
  on public.bud_repair_logs (execution_id, created_at);

create table if not exists public.bud_deployment_verifications (
  id              uuid        primary key default gen_random_uuid(),
  execution_id    uuid        references public.bud_repair_executions(id) on delete set null,
  deployment_url  text,
  environment     text        not null default 'preview',
  status          text        not null default 'running'
                                check (status in ('running','passed','failed','blocked')),
  checks          jsonb       not null default '[]',
  route_results   jsonb       not null default '[]',
  api_results     jsonb       not null default '[]',
  console_errors  jsonb       not null default '[]',
  performance     jsonb       not null default '{}',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists bud_deployment_verifications_execution_idx
  on public.bud_deployment_verifications (execution_id, started_at desc);

create table if not exists public.bud_repair_learnings (
  id              uuid        primary key default gen_random_uuid(),
  execution_id    uuid        references public.bud_repair_executions(id) on delete set null,
  task_id          uuid        references public.bud_tasks(id) on delete set null,
  memory_doc_id    uuid        references public.memory_documents(id) on delete set null,
  root_cause_type  text,
  fix_pattern      text        not null,
  outcome          text        not null check (outcome in ('recovered','blocked','failed','rolled_back')),
  confidence_delta numeric(5,2),
  evidence         jsonb       not null default '{}',
  created_at       timestamptz not null default now()
);

create index if not exists bud_repair_learnings_root_cause_idx
  on public.bud_repair_learnings (root_cause_type, created_at desc);

create table if not exists public.bud_terminal_sessions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id),
  command     text        not null,
  status      text        not null default 'running' check (status in ('running','passed','failed','blocked')),
  output      text,
  exit_code   int,
  started_at  timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists bud_terminal_sessions_started_idx
  on public.bud_terminal_sessions (started_at desc);

alter table public.bud_repair_executions        enable row level security;
alter table public.bud_repair_steps             enable row level security;
alter table public.bud_repair_logs              enable row level security;
alter table public.bud_deployment_verifications enable row level security;
alter table public.bud_repair_learnings         enable row level security;
alter table public.bud_terminal_sessions        enable row level security;

create policy "admin_all_bud_repair_executions"
  on public.bud_repair_executions for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

create policy "admin_all_bud_repair_steps"
  on public.bud_repair_steps for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

create policy "admin_all_bud_repair_logs"
  on public.bud_repair_logs for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

create policy "admin_all_bud_deployment_verifications"
  on public.bud_deployment_verifications for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

create policy "admin_all_bud_repair_learnings"
  on public.bud_repair_learnings for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

create policy "admin_all_bud_terminal_sessions"
  on public.bud_terminal_sessions for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));
