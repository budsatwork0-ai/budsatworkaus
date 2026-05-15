-- =====================================================================
-- Migration 037: AI Agent Infrastructure
-- =====================================================================
-- Adds the schema for autonomous agents that run alongside the rest of
-- the Buds At Work app. The model is:
--   agents        — catalog of agent definitions (one row per agent)
--   agent_runs    — every invocation, with status, cost, duration, IO
--   agent_actions — concrete side effects an agent wants to take
--                   (requires_approval=true keeps them in a queue
--                   until a human flips status to 'approved')
--   agent_memory  — small KV store per agent for "what I've learned"
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. agents: registry of agent definitions
-- ---------------------------------------------------------------------
create table if not exists public.agents (
  id              text primary key,            -- slug, e.g. 'quote-triage'
  name            text not null,
  description     text not null,
  category        text not null check (category in (
                    'sales','support','ops','hiring','finance','compliance'
                  )),
  status          text not null default 'enabled' check (status in (
                    'enabled','paused','disabled'
                  )),
  autonomy        text not null default 'review' check (autonomy in (
                    'auto',       -- runs and acts without human review
                    'review',     -- runs but actions sit in approval queue
                    'manual'      -- only runs when triggered by a human
                  )),
  schedule        text,                        -- cron expr or null
  config          jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. agent_runs: one row per invocation
-- ---------------------------------------------------------------------
create table if not exists public.agent_runs (
  id              uuid primary key default gen_random_uuid(),
  agent_id        text not null references public.agents(id) on delete cascade,
  trigger         text not null check (trigger in (
                    'cron','manual','webhook','event'
                  )),
  triggered_by    uuid references auth.users(id) on delete set null,
  status          text not null default 'running' check (status in (
                    'running','succeeded','failed','needs_approval','cancelled'
                  )),
  input           jsonb not null default '{}'::jsonb,
  output          jsonb,
  summary         text,                        -- short human-readable result
  error           text,
  model           text,                        -- e.g. 'claude-sonnet-4-6'
  input_tokens    integer default 0,
  output_tokens   integer default 0,
  cost_cents      integer default 0,           -- estimated $ cost in cents
  duration_ms     integer,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create index if not exists idx_agent_runs_agent_id_started
  on public.agent_runs(agent_id, started_at desc);
create index if not exists idx_agent_runs_status
  on public.agent_runs(status) where status in ('running','needs_approval');

-- ---------------------------------------------------------------------
-- 3. agent_actions: concrete side-effects proposed/taken by a run
-- ---------------------------------------------------------------------
create table if not exists public.agent_actions (
  id                  uuid primary key default gen_random_uuid(),
  run_id              uuid not null references public.agent_runs(id) on delete cascade,
  agent_id            text not null references public.agents(id) on delete cascade,
  action_type         text not null,           -- 'send_email','create_quote','schedule_job',...
  target_table        text,                    -- e.g. 'quotes','customers'
  target_id           text,                    -- e.g. quote uuid
  payload             jsonb not null default '{}'::jsonb,
  preview             text,                    -- human-readable summary
  requires_approval   boolean not null default true,
  status              text not null default 'pending' check (status in (
                        'pending','approved','rejected','executed','failed'
                      )),
  executed_at         timestamptz,
  reviewed_by         uuid references auth.users(id) on delete set null,
  reviewed_at         timestamptz,
  review_notes        text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_agent_actions_status
  on public.agent_actions(status) where status = 'pending';
create index if not exists idx_agent_actions_run
  on public.agent_actions(run_id);

-- ---------------------------------------------------------------------
-- 4. agent_memory: persistent "lessons learned" per agent
-- ---------------------------------------------------------------------
create table if not exists public.agent_memory (
  id          uuid primary key default gen_random_uuid(),
  agent_id    text not null references public.agents(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  weight      real not null default 1.0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(agent_id, key)
);

-- ---------------------------------------------------------------------
-- 5. updated_at triggers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

drop trigger if exists trg_agent_memory_updated_at on public.agent_memory;
create trigger trg_agent_memory_updated_at
  before update on public.agent_memory
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 6. Row-level security: admin-only read/write
-- ---------------------------------------------------------------------
alter table public.agents          enable row level security;
alter table public.agent_runs      enable row level security;
alter table public.agent_actions   enable row level security;
alter table public.agent_memory    enable row level security;

-- Adjust this predicate to match your existing admin-detection scheme.
-- Most Buds At Work admin tables already check raw_app_meta_data->>'role'.
create policy if not exists "agents_admin_read"
  on public.agents for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "agents_admin_write"
  on public.agents for all
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "agent_runs_admin_read"
  on public.agent_runs for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "agent_runs_service_write"
  on public.agent_runs for all
  using (auth.role() = 'service_role');

create policy if not exists "agent_actions_admin_read"
  on public.agent_actions for select
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "agent_actions_admin_write"
  on public.agent_actions for update
  using (
    (auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner')
  );

create policy if not exists "agent_actions_service_write"
  on public.agent_actions for all
  using (auth.role() = 'service_role');

create policy if not exists "agent_memory_service"
  on public.agent_memory for all
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 7. Seed the 8 agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('quote-triage',      'Quote Triage',       'Classifies incoming quote requests, drafts a quote using pricing rules, auto-sends standard jobs under threshold.', 'sales',      'review', '*/10 * * * *',  '{"auto_send_under_aud": 250}'::jsonb),
  ('customer-reply',    'Customer Reply',     'Drafts first-pass replies to inbound contact-form and email messages.',                                              'support',    'review', '*/15 * * * *',  '{}'::jsonb),
  ('scheduling',        'Job Scheduling',     'Builds the next-day run sheet by matching confirmed jobs to crew, vehicles, equipment, and weather.',                'ops',        'review', '0 16 * * *',    '{"timezone":"Australia/Brisbane"}'::jsonb),
  ('applicant-screener','Applicant Screener', 'First-pass screening of crew applicants: in-area, license, basic checks. Drafts invites or polite declines.',         'hiring',     'review', '0 9 * * 1-5',   '{}'::jsonb),
  ('ndis-compliance',   'NDIS Compliance',    'Ensures every NDIS job has the right paperwork (service agreement, plan, invoice formatting) before invoicing.',     'compliance', 'review', '0 8,16 * * *',  '{}'::jsonb),
  ('reviews',           'Reviews & Reputation','Sends post-job review requests, follows up once, flags negative feedback before it hits Google.',                    'support',    'review', '0 10 * * *',    '{"follow_up_after_days":3}'::jsonb),
  ('crew-briefing',     'Crew Today Briefing','Generates each crew member''s daily run-sheet message with addresses, gate codes, customer notes.',                   'ops',        'auto',   '0 6 * * *',     '{"channel":"sms"}'::jsonb),
  ('reconciliation',    'Payment Reconciliation','Compares Stripe + PayPal payments against orders/invoices, flags mismatches and overdue payables.',               'finance',    'review', '0 7 * * *',     '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 8. Convenience view: pending approvals across all agents
-- ---------------------------------------------------------------------
create or replace view public.v_pending_agent_actions as
select
  a.id              as action_id,
  a.run_id,
  a.agent_id,
  ag.name           as agent_name,
  a.action_type,
  a.preview,
  a.payload,
  a.created_at
from public.agent_actions a
join public.agents ag on ag.id = a.agent_id
where a.status = 'pending'
order by a.created_at desc;
