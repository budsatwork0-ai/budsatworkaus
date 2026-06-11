-- Phase 3A: Content Studio Ideas
-- Turns approved/scored Story Opportunities into trackable content ideas.
-- No scripts, assets, publishing queue, AI generation, agents, or automations.

create table if not exists public.content_ideas (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,

  -- Optional Story Engine links
  opportunity_id      uuid        references public.story_opportunities(id) on delete set null,
  related_arc_id      uuid        references public.story_arcs(id) on delete set null,
  related_characters  text[]      not null default '{}',

  -- Idea metadata
  platform_fit        text        not null default '',
  format              text        not null default '',
  hook                text        not null default '',
  content_angle       text        not null default '',

  -- Workflow status. Scripted is only a tracking state; Phase 3A creates no scripts.
  status              text        not null default 'captured'
                                  check (status in ('captured', 'developed', 'scripted', 'archived')),
  priority            integer     not null default 0,
  notes               text        not null default '',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_content_ideas_status      on public.content_ideas (status);
create index if not exists idx_content_ideas_priority    on public.content_ideas (priority);
create index if not exists idx_content_ideas_opportunity on public.content_ideas (opportunity_id);
create index if not exists idx_content_ideas_arc         on public.content_ideas (related_arc_id);

-- updated_at trigger
create or replace function public.handle_content_ideas_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_ideas_updated_at on public.content_ideas;
create trigger set_content_ideas_updated_at
  before update on public.content_ideas
  for each row execute function public.handle_content_ideas_updated_at();

-- RLS: admin/owner only
alter table public.content_ideas enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_ideas' and policyname = 'Admins manage content ideas'
  ) then
    create policy "Admins manage content ideas"
      on public.content_ideas for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
