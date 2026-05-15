-- =====================================================================
-- Migration 039: Batch 2 agents (Lead Scorer, Photo QA, Yard Map, Phone)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Phone-call records (the source data for the Transcriber agent)
-- ---------------------------------------------------------------------
create table if not exists public.phone_calls (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid references public.customers(id) on delete set null,
  direction       text not null check (direction in ('inbound','outbound')),
  from_number     text,
  to_number       text,
  duration_s      integer,
  recording_url   text,
  transcript      text,
  summary         text,
  action_items    jsonb default '[]'::jsonb,
  sentiment       text,
  agent_processed_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_phone_calls_unprocessed
  on public.phone_calls(created_at) where agent_processed_at is null;

alter table public.phone_calls enable row level security;
create policy if not exists "phone_calls_admin_read"
  on public.phone_calls for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'));
create policy if not exists "phone_calls_service"
  on public.phone_calls for all
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 2. Job photos (the source data for the Photo QA agent)
-- ---------------------------------------------------------------------
create table if not exists public.job_photos (
  id             uuid primary key default gen_random_uuid(),
  job_id         uuid not null references public.jobs(id) on delete cascade,
  kind           text not null check (kind in ('before','after','damage','note')),
  storage_path   text not null,             -- supabase storage object path
  uploaded_by    uuid references auth.users(id) on delete set null,
  uploaded_at    timestamptz not null default now(),
  qa_score       integer,                   -- 0-100, set by photo-qa agent
  qa_notes       text,
  marketing_ok   boolean default false,     -- approved for marketing use
  tags           text[] default '{}'::text[]
);
create index if not exists idx_job_photos_job on public.job_photos(job_id);
create index if not exists idx_job_photos_qa_pending
  on public.job_photos(uploaded_at) where qa_score is null;

alter table public.job_photos enable row level security;
create policy if not exists "job_photos_admin_read"
  on public.job_photos for select
  using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('admin','owner'));
create policy if not exists "job_photos_service"
  on public.job_photos for all
  using (auth.role() = 'service_role');

-- ---------------------------------------------------------------------
-- 3. New columns on existing tables
-- ---------------------------------------------------------------------
alter table public.quotes
  add column if not exists lead_score        integer,
  add column if not exists lead_score_at     timestamptz,
  add column if not exists yard_sqm          numeric,
  add column if not exists yard_complexity   text check (yard_complexity in (null,'simple','moderate','complex')),
  add column if not exists geo_image_url     text;

-- ---------------------------------------------------------------------
-- 4. Seed the 4 new agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('lead-scorer',       'Lead Scorer',
     'Scores every inbound lead 0-100 on suburb, service mix, message quality, and behavioural signals.',
     'sales',   'auto',   '*/5 * * * *',   '{"weight_behaviour":0.4,"weight_message":0.3,"weight_suburb":0.2,"weight_history":0.1}'::jsonb),

  ('photo-qa',          'Photo QA',
     'Reviews job before/after photos: completeness, framing, lighting; picks marketing-ready shots.',
     'ops',     'review', '*/20 * * * *',  '{"min_score_for_marketing":80}'::jsonb),

  ('yard-map-geo',      'Yard Map / Geo',
     'Pulls satellite imagery for an address, estimates lawn area + complexity, feeds Quote Triage.',
     'ops',     'auto',   null,            '{"max_zoom":20,"provider":"google_static_maps"}'::jsonb),

  ('phone-transcriber', 'Phone Transcriber',
     'Transcribes inbound/outbound calls, attaches summary + action items to the customer record.',
     'support', 'auto',   '*/10 * * * *',  '{"provider":"whisper","language":"en-AU"}'::jsonb)
on conflict (id) do nothing;
