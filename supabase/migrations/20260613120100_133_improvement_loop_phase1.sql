-- 133_improvement_loop_phase1
-- Phase 1 of the continuous agent improvement loop:
--   * sandbox_run_batches            (one scheduled sweep of an agent's suite)
--   * sandbox_training_runs.batch_id (link existing runs to batches)
--   * sandbox_agent_health           (rolling per-agent health snapshots)
--   * agent_config_versions          (versioned configs; backfilled v1; READ-ONLY copy — agents.config is NOT modified)
--   * sandbox_policy                 (policy knobs; auto-promotion seeded OFF)
-- All new tables get RLS + the standard admin/service policy pattern.
-- No production/operational tables are touched.

-- ── 1. Run batches ───────────────────────────────────────────────────
create table if not exists public.sandbox_run_batches (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  trigger text not null default 'cron'
    check (trigger in ('cron','manual','eval')),
  proposal_id uuid,                       -- FK added in Phase 3 when proposals table exists
  status text not null default 'running'
    check (status in ('running','complete','failed')),
  scenario_count int not null default 0,
  pass_count int not null default 0,
  avg_f1 numeric,
  total_cost_cents int not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_sandbox_run_batches_agent
  on public.sandbox_run_batches (agent_id, started_at desc);

alter table public.sandbox_training_runs
  add column if not exists batch_id uuid references public.sandbox_run_batches(id);
create index if not exists idx_sandbox_training_runs_batch
  on public.sandbox_training_runs (batch_id);

-- ── 2. Health snapshots ──────────────────────────────────────────────
create table if not exists public.sandbox_agent_health (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  window_start timestamptz not null,
  window_end timestamptz not null,
  runs int not null default 0,
  pass_rate numeric,
  avg_f1 numeric,
  avg_precision numeric,
  avg_recall numeric,
  baseline_f1 numeric,
  delta_f1 numeric,
  trend text not null default 'stable'
    check (trend in ('improving','stable','degrading')),
  computed_at timestamptz not null default now()
);
create index if not exists idx_sandbox_agent_health_agent
  on public.sandbox_agent_health (agent_id, computed_at desc);

-- ── 3. Versioned agent configs (audit/rollback foundation) ───────────
create table if not exists public.agent_config_versions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null references public.agents(id),
  version int not null,
  config jsonb not null,
  source text not null default 'manual'
    check (source in ('manual','proposal','migration')),
  proposal_id uuid,                       -- FK added in Phase 3
  created_by text,
  created_at timestamptz not null default now(),
  unique (agent_id, version)
);

-- Backfill v1 from the CURRENT config of every agent. Read-only with
-- respect to agents: agents.config is copied, never modified.
insert into public.agent_config_versions (agent_id, version, config, source, created_by)
select a.id, 1, a.config, 'migration', 'migration_133'
from public.agents a
on conflict (agent_id, version) do nothing;

-- ── 4. Policy knobs ──────────────────────────────────────────────────
create table if not exists public.sandbox_policy (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

insert into public.sandbox_policy (key, value, description) values
  ('regression_minor_drop',    '0.10',  'Delta-F1 drop vs baseline that opens a minor regression'),
  ('regression_critical_drop', '0.25',  'Delta-F1 drop that opens a critical regression and pauses the improver'),
  ('auto_promote_enabled',     'false', 'Master switch for human-free promotion. KEEP FALSE until trust is established.'),
  ('auto_promote_max_risk',    '"low"', 'Highest proposal risk level eligible for auto-promotion'),
  ('auto_promote_min_delta',   '0.05',  'Minimum eval delta-F1 required to auto-promote'),
  ('max_daily_cost_cents',     '500',   'Sandbox spend cap per day'),
  ('max_proposals_per_agent',  '2',     'Max concurrent open proposals per agent'),
  ('eval_min_scenarios',       '5',     'Minimum regression-suite size for a valid eval')
on conflict (key) do nothing;

-- ── 5. RLS on all new tables (same pattern as migration 132) ─────────
alter table public.sandbox_run_batches   enable row level security;
alter table public.sandbox_agent_health  enable row level security;
alter table public.agent_config_versions enable row level security;
alter table public.sandbox_policy        enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'sandbox_run_batches','sandbox_agent_health',
    'agent_config_versions','sandbox_policy']
  loop
    execute format('drop policy if exists %I_admin_read on public.%I', t, t);
    execute format($p$
      create policy %I_admin_read on public.%I
        for select using (exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.role = any (array['admin','owner'])))
    $p$, t, t);

    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format($p$
      create policy %I_admin_write on public.%I
        for all using (exists (
          select 1 from profiles p
          where p.id = auth.uid() and p.role = any (array['admin','owner'])))
    $p$, t, t);

    execute format('drop policy if exists %I_service on public.%I', t, t);
    execute format($p$
      create policy %I_service on public.%I
        for all using (auth.role() = 'service_role')
    $p$, t, t);
  end loop;
end $$;
