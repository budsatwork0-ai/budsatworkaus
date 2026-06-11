-- 044_foreman.sql
--
-- The Foreman — operational intelligence layer for the AI agent workforce.
-- Adds three tables:
--   foreman_lobby_states  — versioned operational snapshots (one active at a time)
--   foreman_insights      — Foreman-generated operational insights (separate from design_insights)
--   agent_workflow_memberships — static index of workflow chain membership (mirrors workflows.ts)

-- ── foreman_lobby_states ─────────────────────────────────────────────────────

create table if not exists public.foreman_lobby_states (
  id                 uuid        primary key default gen_random_uuid(),
  generated_at       timestamptz not null default now(),
  operational_status text        not null default 'nominal'
                                 check (operational_status in ('nominal', 'elevated', 'critical')),
  summary            text,
  sections           jsonb       not null default '[]',
  workflows          jsonb       not null default '[]',
  kpis               jsonb       not null default '{}',
  agent_states       jsonb       not null default '{}',
  is_current         boolean     not null default false
);

-- Only one row can be current at a time.
create unique index if not exists foreman_lobby_states_current_idx
  on public.foreman_lobby_states (is_current)
  where is_current = true;

create index if not exists foreman_lobby_states_generated_at_idx
  on public.foreman_lobby_states (generated_at desc);

alter table public.foreman_lobby_states enable row level security;

drop policy if exists "Admins read foreman lobby states" on public.foreman_lobby_states;
create policy "Admins read foreman lobby states"
  on public.foreman_lobby_states
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── foreman_insights ─────────────────────────────────────────────────────────

create table if not exists public.foreman_insights (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  agent_id    text        references public.agents(id) on delete set null,
  workflow_id text,
  category    text        not null
              check (category in ('bottleneck', 'anomaly', 'pattern', 'opportunity', 'risk')),
  severity    text        not null default 'medium'
              check (severity in ('low', 'medium', 'high', 'critical')),
  title       text        not null,
  body        text,
  resolved_at timestamptz,
  resolved_by text
);

create index if not exists foreman_insights_created_at_idx
  on public.foreman_insights (created_at desc);

create index if not exists foreman_insights_severity_idx
  on public.foreman_insights (severity, created_at desc);

alter table public.foreman_insights enable row level security;

drop policy if exists "Admins read foreman insights" on public.foreman_insights;
create policy "Admins read foreman insights"
  on public.foreman_insights
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'owner')
    )
  );

-- ── agent_workflow_memberships ───────────────────────────────────────────────
-- Mirrors the static WORKFLOWS constant in workflows.ts.
-- Exists so SQL queries can join without importing TypeScript.

create table if not exists public.agent_workflow_memberships (
  workflow_id  text not null,
  agent_id     text not null references public.agents(id) on delete cascade,
  position     int  not null,
  primary key (workflow_id, agent_id)
);

insert into public.agent_workflow_memberships (workflow_id, agent_id, position) values
  -- customer-acquisition
  ('customer-acquisition', 'phone-transcriber',   0),
  ('customer-acquisition', 'customer-reply',       1),
  ('customer-acquisition', 'quote-triage',         2),
  ('customer-acquisition', 'lead-scorer',          3),
  ('customer-acquisition', 'scheduling',           4),
  ('customer-acquisition', 'crew-briefing',        5),
  -- job-delivery
  ('job-delivery', 'scheduling',    0),
  ('job-delivery', 'photo-qa',      1),
  ('job-delivery', 'yard-map-geo',  2),
  ('job-delivery', 'crew-briefing', 3),
  ('job-delivery', 'crew-coach',    4),
  -- revenue-intelligence
  ('revenue-intelligence', 'reconciliation',          0),
  ('revenue-intelligence', 'cash-flow-forecaster',   1),
  ('revenue-intelligence', 'stripe-dispute-manager', 2),
  ('revenue-intelligence', 'price-optimizer',        3),
  -- growth-loop
  ('growth-loop', 'seo-meta',          0),
  ('growth-loop', 'copy-optimizer',    1),
  ('growth-loop', 'content-agent',     2),
  ('growth-loop', 'ab-test-architect', 3),
  ('growth-loop', 'conversion-funnel', 4),
  ('growth-loop', 'competitor-scout',  5),
  -- compliance-safety
  ('compliance-safety', 'ndis-compliance',     0),
  ('compliance-safety', 'ndis-plan-matcher',   1),
  ('compliance-safety', 'whs-safety-reminder', 2),
  -- talent-pipeline
  ('talent-pipeline', 'applicant-screener', 0),
  ('talent-pipeline', 'crew-coach',         1),
  ('talent-pipeline', 'reviews',            2),
  -- win-back
  ('win-back', 'lapsed-win-back', 0),
  ('win-back', 'customer-reply',  1),
  ('win-back', 'lead-scorer',     2)
on conflict do nothing;

-- ── realtime ─────────────────────────────────────────────────────────────────
-- Let the ForemanConsole subscribe to state changes without polling.

alter publication supabase_realtime add table public.foreman_lobby_states;
alter publication supabase_realtime add table public.foreman_insights;
