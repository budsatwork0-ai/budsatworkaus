-- =====================================================================
-- Migration 077: Marketing Studio — agent marketing team + scoreboard
-- =====================================================================
-- Adds the data layer behind the /dashboard/insights "Marketing Studio" tab:
--   * marketing_metrics   — daily per-channel scoreboard (manual now, API later)
--   * marketing_campaigns — campaigns (e.g. Streak-Free July window cleans)
--   * capture_briefs      — Field Producer's daily "film this" briefs
--   * content_drafts      — extended (additive) with campaign link
-- Plus agent seeds for the marketing pod and the first campaign.
--
-- Backwards-compatible: no existing column is dropped or retyped.
-- RLS mirrors the service-role-write / admin-read pattern from 040.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Scoreboard — daily metric snapshots
-- ---------------------------------------------------------------------
create table if not exists public.marketing_metrics (
  id                uuid primary key default gen_random_uuid(),
  snapshot_date     date not null,
  channel           text not null check (channel in ('instagram','tiktok','facebook','gbp','combined')),
  views             integer not null default 0,
  engagements       integer not null default 0,
  content_published integer not null default 0,
  followers         integer not null default 0,
  source            text not null default 'manual' check (source in ('manual','api')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (snapshot_date, channel)
);
create index if not exists idx_marketing_metrics_date on public.marketing_metrics(snapshot_date desc);

-- ---------------------------------------------------------------------
-- 2. Campaigns
-- ---------------------------------------------------------------------
create table if not exists public.marketing_campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  service_type  text,
  hook          text,
  starts_on     date,
  ends_on       date,
  status        text not null default 'planning'
                  check (status in ('planning','active','wrapped','archived')),
  goal_notes    text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_marketing_campaigns_status on public.marketing_campaigns(status);

-- ---------------------------------------------------------------------
-- 3. Daily capture briefs (Field Producer)
-- ---------------------------------------------------------------------
create table if not exists public.capture_briefs (
  id            uuid primary key default gen_random_uuid(),
  brief_date    date not null unique,
  job_context   text,                       -- service + suburb for the day
  shot_list     text[] default '{}'::text[],
  say_to_camera text,
  run_id        uuid references public.agent_runs(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Extend content_drafts (additive, backwards-compatible)
-- ---------------------------------------------------------------------
alter table public.content_drafts
  add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
-- broaden channel check to include tiktok (drop+recreate the named constraint safely)
do $$
begin
  if exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'content_drafts' and constraint_name = 'content_drafts_channel_check'
  ) then
    alter table public.content_drafts drop constraint content_drafts_channel_check;
  end if;
end $$;
alter table public.content_drafts
  add constraint content_drafts_channel_check
  check (channel in ('instagram','tiktok','facebook','gbp','blog','email'));

-- ---------------------------------------------------------------------
-- 5. RLS — service role full, admin read
-- ---------------------------------------------------------------------
alter table public.marketing_metrics   enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.capture_briefs      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['marketing_metrics','marketing_campaigns','capture_briefs']
  loop
    execute format($f$
      drop policy if exists "%1$s_service_all" on public.%1$s;
      create policy "%1$s_service_all" on public.%1$s
        for all to service_role using (true) with check (true);
    $f$, t);

    execute format($f$
      drop policy if exists "%1$s_admin_read" on public.%1$s;
      create policy "%1$s_admin_read" on public.%1$s
        for select to authenticated
        using (exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin','owner')
        ));
    $f$, t);
  end loop;
end $$;

-- Authenticated admins may insert/update marketing_metrics (manual daily logging from the dashboard)
drop policy if exists "marketing_metrics_admin_write" on public.marketing_metrics;
create policy "marketing_metrics_admin_write" on public.marketing_metrics
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')
  ));
drop policy if exists "marketing_metrics_admin_update" on public.marketing_metrics;
create policy "marketing_metrics_admin_update" on public.marketing_metrics
  for update to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','owner')
  ));

-- ---------------------------------------------------------------------
-- 6. Seed the marketing pod into public.agents
-- ---------------------------------------------------------------------
insert into public.agents (id, name, description, category, autonomy, schedule, config) values
  ('stanley-henry',
   'Stanley Henry',
   'Creative Director. Turns real job footage and campaign goals into premium ad concepts and full briefs, and guards the warm Australian tradie brand voice. Proposes; human approves.',
   'sales', 'review', '0 7 * * 1', '{}'::jsonb),

  ('attention-seeker',
   'The Attention Seeker',
   'Growth & distribution lead. Owns hooks, trends, posting cadence, hashtags and the follower/engagement curve. Reads the scoreboard and doubles down on what works.',
   'sales', 'review', '0 8 * * *', '{}'::jsonb),

  ('field-producer',
   'Field Producer',
   'Issues a dead-simple daily capture brief from the day''s scheduled jobs (what to film, the one before/after to nail, the line to say to camera). Evergreen brief on no-job days.',
   'sales', 'auto', '30 6 * * *', '{}'::jsonb),

  ('scoreboard-keeper',
   'Scoreboard Keeper',
   'Owns the marketing numbers. Validates and stores daily metrics, computes deltas and streaks, and flags anomalies for the pod. Switches from manual entry to API pulls when connected.',
   'sales', 'auto', '0 9 * * *', '{}'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. Seed the first campaign — Streak-Free July (window cleans, 8–11 Jul)
-- ---------------------------------------------------------------------
insert into public.marketing_campaigns (name, service_type, hook, starts_on, ends_on, status, goal_notes)
select
  'Streak-Free July',
  'window',
  'Streak-free or we come back free',
  date '2026-06-24',           -- 2-week ramp before the booking
  date '2026-07-18',           -- 1-week proof run after
  'planning',
  'First real campaign. Built around the unofficial 8–11 July window-clean booking. Goal: turn one booking into a booked-out window-clean week and a repeatable template for every service.'
where not exists (select 1 from public.marketing_campaigns where name = 'Streak-Free July');
