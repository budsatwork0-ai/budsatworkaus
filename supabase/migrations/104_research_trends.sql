-- Phase 5A: Research Lab — Trend Intelligence
-- Manual trend entry only. No scraping, no external API calls, no AI generation,
-- no agents, and no automations. Trends are research inputs only.

create table if not exists public.research_trends (
  id                uuid        primary key default gen_random_uuid(),
  platform          text        not null
                                  check (platform in ('tiktok','instagram','facebook','youtube','linkedin','website')),
  title             text        not null,
  description       text        not null default '',
  trend_type        text        not null
                                  check (trend_type in ('audio','format','hook','topic','visual_style','other')),
  urgency           text        not null
                                  check (urgency in ('evergreen','two_week_window','forty_eight_hour_window')),
  adaptation_angle  text        not null default '',
  story_arc_id      uuid,
  status            text        not null default 'watching'
                                  check (status in ('watching','adapting','published','expired')),
  notes             text        not null default '',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_research_trends_platform   on public.research_trends(platform);
create index if not exists idx_research_trends_status     on public.research_trends(status);
create index if not exists idx_research_trends_urgency    on public.research_trends(urgency);
create index if not exists idx_research_trends_trend_type on public.research_trends(trend_type);
create index if not exists idx_research_trends_created_at on public.research_trends(created_at desc);

-- updated_at trigger
create or replace function public.handle_research_trends_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_research_trends_updated_at on public.research_trends;
create trigger set_research_trends_updated_at
  before update on public.research_trends
  for each row execute function public.handle_research_trends_updated_at();

-- RLS: admin/owner only
alter table public.research_trends enable row level security;

drop policy if exists "Admins manage research trends" on public.research_trends;
create policy "Admins manage research trends"
  on public.research_trends for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  ));
