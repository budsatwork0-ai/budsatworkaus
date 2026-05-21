--------------------------------------------------------------------------------
-- Autonomous Improvement Pipeline — Control Plane
--
-- Surfaces:   public, admin, crew, customer
-- Stages:     detect → analyze → design → generate → sandbox → validate
--             → reject → debate → deploy → observe
--
-- Reads gated to admin/owner by RLS. Service role bypasses RLS and is used
-- by the API routes + the worker that orchestrates real runs.
--
-- Required Postgres extensions: pgcrypto (for gen_random_uuid).
-- Optional: pgvector — added later for the memory table.
--------------------------------------------------------------------------------

create extension if not exists pgcrypto;

--------------------------------------------------------------------------------
-- Enums
--------------------------------------------------------------------------------

do $$ begin
  create type public.pipeline_surface as enum ('public','admin','crew','customer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_stage as enum (
    'detect','analyze','design','generate','sandbox',
    'validate','reject','debate','deploy','observe'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_stage_status as enum (
    'idle','active','passed','rejected','skipped'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_run_status as enum (
    'open','in_progress','succeeded','rejected','rolled_back'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pipeline_run_verdict as enum (
    'pending','auto_merge','human_review','rejected','rolled_back'
  );
exception when duplicate_object then null; end $$;

--------------------------------------------------------------------------------
-- Tables
--------------------------------------------------------------------------------

create table if not exists public.pipeline_runs (
  id               uuid primary key default gen_random_uuid(),
  surface          public.pipeline_surface not null,
  trigger_signal   text not null,
  trigger_payload  jsonb,
  status           public.pipeline_run_status  not null default 'open',
  verdict          public.pipeline_run_verdict not null default 'pending',
  composite_score  numeric(4,3),
  pr_url           text,
  preview_url      text,
  rolled_back_at   timestamptz,
  rollback_reason  text,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz
);
create index if not exists pipeline_runs_surface_started_at_idx
  on public.pipeline_runs (surface, started_at desc);
create index if not exists pipeline_runs_status_idx
  on public.pipeline_runs (status);

create table if not exists public.pipeline_stage_events (
  id        bigserial primary key,
  run_id    uuid not null references public.pipeline_runs(id) on delete cascade,
  stage     public.pipeline_stage not null,
  status    public.pipeline_stage_status not null,
  payload   jsonb,
  ts        timestamptz not null default now()
);
create index if not exists pipeline_stage_events_run_ts_idx
  on public.pipeline_stage_events (run_id, ts);

create table if not exists public.pipeline_artifacts (
  id          bigserial primary key,
  run_id      uuid not null references public.pipeline_runs(id) on delete cascade,
  stage       public.pipeline_stage,
  kind        text not null,  -- diff | preview_url | visual_diff | axe | lighthouse | rationale | telemetry
  label       text,
  url         text,
  body        jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists pipeline_artifacts_run_idx
  on public.pipeline_artifacts (run_id, created_at);

create table if not exists public.pipeline_agent_scores (
  id          bigserial primary key,
  run_id      uuid not null references public.pipeline_runs(id) on delete cascade,
  agent       text not null,    -- e.g. 'architect', 'taste', 'skeptic', 'sentinel'
  dimension   text not null,    -- confidence | trust | rollback | UX | stability
  value       numeric(4,3) not null check (value between 0 and 1),
  rationale   text,
  is_skeptic  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists pipeline_agent_scores_run_idx
  on public.pipeline_agent_scores (run_id);

--------------------------------------------------------------------------------
-- KPI view (last 7 days, per surface)
--------------------------------------------------------------------------------

create or replace view public.pipeline_kpis_7d as
  select
    s.surface,
    coalesce(count(*) filter (where r.verdict = 'auto_merge'
                                and r.started_at > now() - interval '7 days'), 0)::int as auto_merged,
    coalesce(count(*) filter (where r.verdict = 'rejected'
                                and r.started_at > now() - interval '7 days'), 0)::int as auto_rejected,
    coalesce(count(*) filter (where r.status  = 'rolled_back'
                                and r.started_at > now() - interval '7 days'), 0)::int as rollbacks,
    coalesce(
      extract(epoch from
        percentile_cont(0.5) within group (
          order by (r.ended_at - r.started_at)
        ) filter (where r.ended_at is not null
                    and r.started_at > now() - interval '7 days')
      ),
      0
    )::int as median_seconds
  from (select unnest(enum_range(null::public.pipeline_surface)) as surface) s
  left join public.pipeline_runs r on r.surface = s.surface
  group by s.surface;

--------------------------------------------------------------------------------
-- Kill-switch + per-surface autonomy policy
--
-- A tiny table the dashboard can flip in real time. Workers MUST consult
-- this before merging anything to production.
--------------------------------------------------------------------------------

create table if not exists public.pipeline_policy (
  surface             public.pipeline_surface primary key,
  autonomy_enabled    boolean not null default false,
  daily_merge_budget  int     not null default 10,
  class_a_auto        boolean not null default true,   -- visual/perf/a11y/copy/refactor
  class_b_auto        boolean not null default false,  -- UX flow tweaks (flagged rollout)
  notes               text,
  updated_at          timestamptz not null default now()
);

-- seed defaults: admin most permissive, public most cautious
insert into public.pipeline_policy (surface, autonomy_enabled, daily_merge_budget, class_a_auto, class_b_auto, notes) values
  ('admin',    true,  20, true,  true,  'Internal users, low blast radius'),
  ('crew',     true,  15, true,  false, 'Class B requires human review on workflow changes'),
  ('customer', false, 10, true,  false, 'Calibration mode; flip autonomy_enabled when rollback rate stays <2%'),
  ('public',   false, 8,  true,  false, 'Locked: pricing copy, legal claims, feature claims, analytics events')
on conflict (surface) do nothing;

create table if not exists public.pipeline_kill_switch (
  id          int primary key default 1,
  paused      boolean not null default false,
  reason      text,
  paused_at   timestamptz,
  paused_by   uuid,
  check (id = 1)
);
insert into public.pipeline_kill_switch (id, paused) values (1, false)
  on conflict (id) do nothing;

--------------------------------------------------------------------------------
-- RLS — admin/owner read-only from the dashboard. Writes come from the
-- service role only (API routes + workers).
--
-- NOTE: this assumes a `public.profiles` table with a `user_id` column and a
-- `role` column. Adjust the helper below to match your auth model.
--------------------------------------------------------------------------------

create or replace function public.is_pipeline_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role in ('admin','owner')
  );
$$;

alter table public.pipeline_runs          enable row level security;
alter table public.pipeline_stage_events  enable row level security;
alter table public.pipeline_artifacts     enable row level security;
alter table public.pipeline_agent_scores  enable row level security;
alter table public.pipeline_policy        enable row level security;
alter table public.pipeline_kill_switch   enable row level security;

drop policy if exists "pipeline_runs read"          on public.pipeline_runs;
drop policy if exists "pipeline_stage_events read"  on public.pipeline_stage_events;
drop policy if exists "pipeline_artifacts read"     on public.pipeline_artifacts;
drop policy if exists "pipeline_agent_scores read"  on public.pipeline_agent_scores;
drop policy if exists "pipeline_policy read"        on public.pipeline_policy;
drop policy if exists "pipeline_kill_switch read"   on public.pipeline_kill_switch;
drop policy if exists "pipeline_kill_switch write"  on public.pipeline_kill_switch;
drop policy if exists "pipeline_policy write"       on public.pipeline_policy;

create policy "pipeline_runs read"
  on public.pipeline_runs for select using (public.is_pipeline_admin());

create policy "pipeline_stage_events read"
  on public.pipeline_stage_events for select using (public.is_pipeline_admin());

create policy "pipeline_artifacts read"
  on public.pipeline_artifacts for select using (public.is_pipeline_admin());

create policy "pipeline_agent_scores read"
  on public.pipeline_agent_scores for select using (public.is_pipeline_admin());

create policy "pipeline_policy read"
  on public.pipeline_policy for select using (public.is_pipeline_admin());

create policy "pipeline_kill_switch read"
  on public.pipeline_kill_switch for select using (public.is_pipeline_admin());

-- Admin/owner CAN toggle the kill switch and adjust the per-surface policy.
create policy "pipeline_kill_switch write"
  on public.pipeline_kill_switch for update using (public.is_pipeline_admin())
                                 with check (public.is_pipeline_admin());

create policy "pipeline_policy write"
  on public.pipeline_policy for update using (public.is_pipeline_admin())
                            with check (public.is_pipeline_admin());

--------------------------------------------------------------------------------
-- Realtime — let the dashboard subscribe to live changes
--------------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pipeline_stage_events'
  ) then
    execute 'alter publication supabase_realtime add table public.pipeline_stage_events';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pipeline_runs'
  ) then
    execute 'alter publication supabase_realtime add table public.pipeline_runs';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pipeline_artifacts'
  ) then
    execute 'alter publication supabase_realtime add table public.pipeline_artifacts';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pipeline_agent_scores'
  ) then
    execute 'alter publication supabase_realtime add table public.pipeline_agent_scores';
  end if;
end $$;
