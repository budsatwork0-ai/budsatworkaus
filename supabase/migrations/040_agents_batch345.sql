-- =====================================================================
-- Migration 040: Batches 3, 4, 5 — Marketing, Finance, Wildcards
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Marketing wave: content drafts, lapsed customer outreach, competitor tracking
-- ---------------------------------------------------------------------
create table if not exists public.content_drafts (
  id            uuid primary key default gen_random_uuid(),
  agent_id      text not null references public.agents(id) on delete cascade,
  run_id        uuid references public.agent_runs(id) on delete set null,
  channel       text not null check (channel in ('instagram','facebook','gbp','blog','email')),
  title         text,
  body          text not null,
  photo_ids     uuid[] default '{}'::uuid[],
  hashtags      text[] default '{}'::text[],
  status        text not null default 'draft' check (status in ('draft','approved','scheduled','published','rejected')),
  scheduled_for timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.lapsed_outreach (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid references public.customers(id) on delete cascade,
  last_job_at   timestamptz,
  days_lapsed   integer,
  segment       text,
  drafted_body  text,
  sent_at       timestamptz,
  responded_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.competitor_pages (
  id            uuid primary key default gen_random_uuid(),
  competitor    text not null,
  url           text not null unique,
  last_snapshot text,
  last_checked  timestamptz,
  change_notes  jsonb default '[]'::jsonb
);

-- ---------------------------------------------------------------------
-- 2. Finance wave: cash flow forecasts, dispute evidence, WHS records
-- ---------------------------------------------------------------------
create table if not exists public.cash_flow_forecasts (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references public.agent_runs(id) on delete set null,
  generated_at    timestamptz not null default now(),
  weeks           jsonb not null,            -- [{week_start, expected_in, expected_out, balance}]
  warnings        text[] default '{}'::text[]
);

create table if not exists public.stripe_disputes (
  id              text primary key,           -- stripe dispute id
  charge_id       text,
  customer_id     uuid references public.customers(id) on delete set null,
  amount_cents    integer,
  reason          text,
  status          text,
  evidence_due_at timestamptz,
  evidence_package jsonb,                     -- assembled by agent
  agent_drafted_at timestamptz,
  submitted_at    timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.whs_records (
  id            uuid primary key default gen_random_uuid(),
  crew_member_id uuid references public.crew_members(id) on delete cascade,
  record_type   text not null check (record_type in ('induction','wwcc','first_aid','licence','equipment_check','swms')),
  reference     text,
  issued_at     date,
  expires_at    date,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_whs_records_expiry on public.whs_records(expires_at);

-- ---------------------------------------------------------------------
-- 3. Wildcards: knowledge base (Q&A), crew coaching notes, NDIS matches
-- ---------------------------------------------------------------------
create table if not exists public.knowledge_articles (
  id            uuid primary key default gen_random_uuid(),
  source_path   text,                         -- e.g. 'Buds At Work/SOPs/yard.md'
  title         text not null,
  body          text not null,
  tags          text[] default '{}'::text[],
  embedding     vector(1536),                 -- requires pgvector extension
  updated_at    timestamptz not null default now()
);

create table if not exists public.crew_coach_notes (
  id              uuid primary key default gen_random_uuid(),
  crew_member_id  uuid references public.crew_members(id) on delete cascade,
  run_id          uuid references public.agent_runs(id) on delete set null,
  period_start    date not null,
  period_end      date not null,
  strengths       text[] default '{}'::text[],
  growth_areas    text[] default '{}'::text[],
  notable_jobs    jsonb default '[]'::jsonb,
  summary         text,
  shared_at       timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.ndis_plan_matches (
  id              uuid primary key default gen_random_uuid(),
  participant_id  uuid,
  plan_goals      text[],
  matched_services jsonb,                     -- [{service, estimated_hours, justification}]
  estimated_total_aud numeric,
  run_id          uuid references public.agent_runs(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. RLS (service role + admin read) on all new tables
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select unnest(array[
    'content_drafts','lapsed_outreach','competitor_pages',
    'cash_flow_forecasts','stripe_disputes','whs_records',
    'knowledge_articles','crew_coach_notes','ndis_plan_matches'
  ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy if not exists "%1$s_admin_read" on public.%1$I for select using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'))$f$, t);
    execute format($f$create policy if not exists "%1$s_service" on public.%1$I for all using (auth.role() = 'service_role')$f$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Seed the 9 new agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('content-agent',         'Content Agent',
     'Drafts weekly social posts and local blog content from real jobs and approved photos.',
     'sales',      'review', '0 9 * * 1',     '{"channels":["instagram","facebook","gbp","blog"]}'::jsonb),

  ('lapsed-win-back',       'Lapsed Win-back',
     'Finds customers who haven''t booked in 90+ days; drafts segmented win-back outreach.',
     'sales',      'review', '0 10 * * 2',    '{"lapsed_after_days":90}'::jsonb),

  ('competitor-watcher',    'Competitor Watcher',
     'Tracks local competitor pricing pages and promos; flags moves you should match or beat.',
     'sales',      'review', '0 6 1 * *',     '{"watch_urls":[]}'::jsonb),

  ('cash-flow-forecaster',  'Cash Flow Forecaster',
     'Combines pipeline, recurring revenue, and payables into an 8-week cash forecast.',
     'finance',    'review', '0 7 * * 1',     '{"horizon_weeks":8,"floor_aud":2000}'::jsonb),

  ('stripe-dispute-manager','Stripe Dispute Manager',
     'Assembles dispute evidence (booking, photos, comms, terms) into Stripe''s required format.',
     'finance',    'review', '*/30 * * * *',  '{}'::jsonb),

  ('whs-safety-reminder',   'WHS Safety Reminder',
     'Tracks induction, WWCC, first-aid, licence, and equipment-check expiries across crew.',
     'compliance', 'auto',   '0 6 * * *',     '{"remind_days_before":[30,14,7,1]}'::jsonb),

  ('internal-qa',           'Internal Q&A',
     'Answers crew + admin questions in plain English from your SOPs, contracts, and decisions log.',
     'support',    'manual', null,            '{"corpus_path":"Buds At Work/SOPs"}'::jsonb),

  ('crew-coach',            'Crew Coach',
     'Monthly per-crew-member summary: strengths, growth areas, notable jobs, suggested coaching.',
     'hiring',     'review', '0 8 1 * *',     '{}'::jsonb),

  ('ndis-plan-matcher',     'NDIS Plan Matcher',
     'Given a participant''s plan goals, suggests which services map and how many hours are likely funded.',
     'compliance', 'manual', null,            '{}'::jsonb)
on conflict (id) do nothing;
