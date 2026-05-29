-- ── 053_bud_system.sql ────────────────────────────────────────────────────────
-- Bud: Autonomous AI Operating System
-- Replaces foreman_lobby_states / foreman_insights with bud-namespaced tables.
-- Adds: bud_tasks, bud_activity_feed, bud_approval_queue,
--       bud_change_requests, bud_audit_logs
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Bud lobby states ───────────────────────────────────────────────────────

create table if not exists public.bud_lobby_states (
  id                 uuid        primary key default gen_random_uuid(),
  generated_at       timestamptz not null default now(),
  operational_status text        not null default 'nominal'
                                 check (operational_status in ('nominal', 'elevated', 'critical')),
  bud_state          text        not null default 'idle'
                                 check (bud_state in (
                                   'thinking','investigating','repairing',
                                   'testing','reviewing','deploying','learning','idle'
                                 )),
  summary            text,
  sections           jsonb       not null default '[]',
  workflows          jsonb       not null default '[]',
  kpis               jsonb       not null default '{}',
  agent_states       jsonb       not null default '{}',
  is_current         boolean     not null default false
);

create unique index if not exists bud_lobby_states_current_idx
  on public.bud_lobby_states (is_current)
  where is_current = true;

create index if not exists bud_lobby_states_generated_at_idx
  on public.bud_lobby_states (generated_at desc);

-- ── 2. Bud insights ───────────────────────────────────────────────────────────

create table if not exists public.bud_insights (
  id          uuid        primary key default gen_random_uuid(),
  agent_id    text,
  workflow_id text,
  category    text        not null,
  severity    text        not null check (severity in ('info','warning','critical')),
  title       text        not null,
  body        text,
  metadata    jsonb       not null default '{}',
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists bud_insights_created_at_idx on public.bud_insights (created_at desc);
create index if not exists bud_insights_severity_idx on public.bud_insights (severity);

-- ── 3. Bud tasks ──────────────────────────────────────────────────────────────

create table if not exists public.bud_tasks (
  id                  uuid        primary key default gen_random_uuid(),
  source_agent        text,
  target_agent        text,
  status              text        not null default 'pending'
                                  check (status in (
                                    'pending','in_progress','awaiting_approval',
                                    'completed','failed','archived'
                                  )),
  confidence          numeric(4,3) check (confidence between 0 and 1),
  risk_level          text        check (risk_level in ('low','medium','high','critical')),
  description         text        not null,
  autonomy_level      int         not null default 2 check (autonomy_level between 0 and 5),
  linked_issue        text,
  linked_pr           text,
  linked_deployment   text,
  linked_memory_note  text,
  raw_input           jsonb,
  raw_output          jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists bud_tasks_status_idx on public.bud_tasks (status);
create index if not exists bud_tasks_created_at_idx on public.bud_tasks (created_at desc);

-- ── 4. Bud activity feed ──────────────────────────────────────────────────────

create table if not exists public.bud_activity_feed (
  id          uuid        primary key default gen_random_uuid(),
  event_type  text        not null,
  narrative   text        not null,
  actor       text,
  target      text,
  metadata    jsonb       not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists bud_activity_feed_created_at_idx
  on public.bud_activity_feed (created_at desc);
create index if not exists bud_activity_feed_event_type_idx
  on public.bud_activity_feed (event_type);

-- ── 5. Bud approval queue ─────────────────────────────────────────────────────

create table if not exists public.bud_approval_queue (
  id           uuid        primary key default gen_random_uuid(),
  task_id      uuid        references public.bud_tasks(id) on delete cascade,
  action_type  text        not null,
  payload      jsonb       not null default '{}',
  status       text        not null default 'pending'
                           check (status in ('pending','approved','rejected')),
  requested_by text,
  reviewed_by  uuid        references auth.users(id),
  reviewed_at  timestamptz,
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists bud_approval_queue_status_idx on public.bud_approval_queue (status);
create index if not exists bud_approval_queue_created_at_idx on public.bud_approval_queue (created_at desc);

-- ── 6. Bud change requests ────────────────────────────────────────────────────

create table if not exists public.bud_change_requests (
  id             uuid        primary key default gen_random_uuid(),
  task_id        uuid        references public.bud_tasks(id) on delete cascade,
  branch_name    text,
  issue_url      text,
  pr_url         text,
  deployment_url text,
  status         text        not null default 'open'
                             check (status in ('open','merged','closed','deployed')),
  created_at     timestamptz not null default now()
);

-- ── 7. Bud audit logs ─────────────────────────────────────────────────────────

create table if not exists public.bud_audit_logs (
  id            uuid        primary key default gen_random_uuid(),
  action        text        not null,
  actor_agent   text,
  actor_user    uuid        references auth.users(id),
  target_table  text,
  target_id     text,
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists bud_audit_logs_created_at_idx on public.bud_audit_logs (created_at desc);

-- ── 8. RLS ────────────────────────────────────────────────────────────────────

alter table public.bud_lobby_states    enable row level security;
alter table public.bud_insights        enable row level security;
alter table public.bud_tasks           enable row level security;
alter table public.bud_activity_feed   enable row level security;
alter table public.bud_approval_queue  enable row level security;
alter table public.bud_change_requests enable row level security;
alter table public.bud_audit_logs      enable row level security;

drop policy if exists "admin_all_bud_lobby_states" on public.bud_lobby_states;
create policy "admin_all_bud_lobby_states"
  on public.bud_lobby_states for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_insights" on public.bud_insights;
create policy "admin_all_bud_insights"
  on public.bud_insights for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_tasks" on public.bud_tasks;
create policy "admin_all_bud_tasks"
  on public.bud_tasks for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_activity_feed" on public.bud_activity_feed;
create policy "admin_all_bud_activity_feed"
  on public.bud_activity_feed for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_approval_queue" on public.bud_approval_queue;
create policy "admin_all_bud_approval_queue"
  on public.bud_approval_queue for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_change_requests" on public.bud_change_requests;
create policy "admin_all_bud_change_requests"
  on public.bud_change_requests for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));

drop policy if exists "admin_all_bud_audit_logs" on public.bud_audit_logs;
create policy "admin_all_bud_audit_logs"
  on public.bud_audit_logs for all
  using (auth.jwt() ->> 'role' in ('admin','owner','service_role'));
