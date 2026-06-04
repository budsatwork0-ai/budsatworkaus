-- Phase 2D: Story Opportunities
-- Admin-only, manual management. No AI generation.

create table if not exists public.story_opportunities (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,

  -- Where this opportunity came from
  source_type         text        not null default 'manual'
                                  check (source_type in ('journal', 'character', 'arc', 'open_thread', 'chapter', 'manual')),
  source_ref_id       text,       -- UUID as text: ID from the source table, nullable for manual

  -- Story Engine links
  related_arc_id      uuid        references public.story_arcs(id) on delete set null,
  related_characters  text[]      not null default '{}',

  -- Content angle
  content_angle       text        not null default '',
  suggested_format    text        not null default '',   -- e.g. Reel, Story, Long-form, Thread
  suggested_platform  text        not null default '',   -- e.g. Instagram, TikTok, LinkedIn

  -- Triage
  priority            integer     not null default 0,
  status              text        not null default 'new'
                                  check (status in ('new', 'in_development', 'published', 'passed')),

  -- Which section of the Opportunities page this belongs to
  section             text        not null default 'surfaced'
                                  check (section in ('surfaced', 'tension_map', 'missed_moments')),

  notes               text        not null default '',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_story_opps_status  on public.story_opportunities (status);
create index if not exists idx_story_opps_section on public.story_opportunities (section);
create index if not exists idx_story_opps_arc     on public.story_opportunities (related_arc_id);

-- updated_at trigger
create or replace function public.handle_story_opps_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_opportunities_updated_at on public.story_opportunities;
create trigger set_story_opportunities_updated_at
  before update on public.story_opportunities
  for each row execute function public.handle_story_opps_updated_at();

-- RLS: admin/owner only
alter table public.story_opportunities enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'story_opportunities' and policyname = 'Admins read story opportunities'
  ) then
    create policy "Admins read story opportunities"
      on public.story_opportunities for select
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
