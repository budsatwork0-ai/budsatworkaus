-- Phase 4D: Social Channel Profiles
-- Manual profile management only. No OAuth, no platform API calls, no posting,
-- no analytics fetching, no AI captions, no agents, and no automations.

create table if not exists public.marketing_social_channels (
  id                       uuid        primary key default gen_random_uuid(),
  platform                 text        not null
                                         check (platform in ('tiktok','instagram','facebook','youtube','linkedin','website')),
  handle                   text        not null default '',
  profile_url              text        not null default '',
  primary_format           text        not null default '',
  posting_target_per_week  integer     not null default 0,
  primary_audience         text        not null default '',
  content_notes            text        not null default '',
  status                   text        not null default 'planned'
                                         check (status in ('active','paused','planned','archived')),
  connected                boolean     not null default false,
  notes                    text        not null default '',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (platform)
);

create index if not exists idx_marketing_social_channels_status   on public.marketing_social_channels(status);
create index if not exists idx_marketing_social_channels_platform on public.marketing_social_channels(platform);

-- updated_at trigger
create or replace function public.handle_marketing_social_channels_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_marketing_social_channels_updated_at on public.marketing_social_channels;
create trigger set_marketing_social_channels_updated_at
  before update on public.marketing_social_channels
  for each row execute function public.handle_marketing_social_channels_updated_at();

-- RLS: admin/owner only
alter table public.marketing_social_channels enable row level security;

drop policy if exists "Admins manage marketing social channels" on public.marketing_social_channels;
create policy "Admins manage marketing social channels"
  on public.marketing_social_channels for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'owner')
  ));

-- Seed: one profile per platform, all planned by default
insert into public.marketing_social_channels (platform, status, notes) values
  ('tiktok',    'planned', 'Short-form video. Manual posting only.'),
  ('instagram', 'planned', 'Photos and reels. Manual posting only.'),
  ('facebook',  'planned', 'Community and long-form updates. Manual posting only.'),
  ('youtube',   'planned', 'Long-form video. Manual posting only.'),
  ('linkedin',  'planned', 'Professional updates and milestones. Manual posting only.'),
  ('website',   'planned', 'Blog and news section. Manual publishing only.')
on conflict (platform) do nothing;
