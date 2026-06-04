-- Phase 2C: Story Arcs, Open Threads, Current Chapter
-- All tables are admin-only, manual edit only.

-- ─────────────────────────────────────────────────────────────
-- Story Arcs
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_arcs (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,
  description         text        not null default '',
  status              text        not null default 'active'
                                  check (status in ('active', 'planted', 'resolved', 'abandoned')),
  start_date          date,
  end_date            date,
  priority            integer     not null default 0,
  characters_involved text[]      not null default '{}',
  journal_entry_links text[]      not null default '{}',
  progress_notes      text        not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_story_arcs_status on public.story_arcs (status);
create index if not exists idx_story_arcs_priority on public.story_arcs (priority);

-- Seed 4 initial arcs
insert into public.story_arcs (title, description, status, priority) values
  (
    'Building Buds At Work',
    'The central arc: building a real local services business from the ground up. Every booking, every system, every customer relationship is part of this arc.',
    'active', 1
  ),
  (
    'Silvan''s Employment Journey',
    'Silvan starting work, learning the trade, and building skills and income alongside the business.',
    'active', 2
  ),
  (
    'Can Bud OS Build A Business?',
    'Testing whether AI systems and automation can genuinely drive customer acquisition and operational efficiency at a local business scale.',
    'active', 3
  ),
  (
    'Community Impact',
    'The longer arc of what Buds At Work means in the local community — NDIS, accessibility, local employment, relationships.',
    'planted', 4
  )
on conflict do nothing;

create or replace function public.handle_story_arcs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_arcs_updated_at on public.story_arcs;
create trigger set_story_arcs_updated_at
  before update on public.story_arcs
  for each row execute function public.handle_story_arcs_updated_at();

alter table public.story_arcs enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'story_arcs' and policyname = 'Admins read story arcs'
  ) then
    create policy "Admins read story arcs" on public.story_arcs for select
      using (exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Open Threads
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_open_threads (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,
  description         text        not null default '',
  related_arc_id      uuid        references public.story_arcs(id) on delete set null,
  related_characters  text[]      not null default '{}',
  status              text        not null default 'open'
                                  check (status in ('open', 'resolved', 'abandoned')),
  opened_date         date        not null default current_date,
  closed_date         date,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_story_threads_status on public.story_open_threads (status);
create index if not exists idx_story_threads_arc on public.story_open_threads (related_arc_id);

-- Seed open threads
insert into public.story_open_threads (title, description, status) values
  ('First Recurring Customer',                'A customer books Buds At Work more than once without being prompted.', 'open'),
  ('First Customer of 2026',                  'The first confirmed paid booking in the 2026 calendar year.', 'open'),
  ('First Commercial Contract',               'First ongoing commercial cleaning or maintenance agreement with a business.', 'open'),
  ('First NDIS Participant Employed',         'First NDIS participant matched and employed through the coordination system.', 'open'),
  ('First Recurring Lawn Customer',           'A customer books lawn care services on a recurring basis.', 'open'),
  ('First Recurring Window Cleaning Customer','A customer books window cleaning on a recurring basis.', 'open'),
  ('First Employee (Non-NDIS)',               'First paid team member who is not an NDIS participant.', 'open'),
  ('First $1,000 Month',                      'Buds At Work records over $1,000 in revenue in a single calendar month.', 'open'),
  ('First $10,000 Month',                     'Buds At Work records over $10,000 in revenue in a single calendar month.', 'open'),
  ('Bud OS Generates a Customer',             'A customer is directly attributable to an automated Bud OS action with no human intervention.', 'open')
on conflict do nothing;

create or replace function public.handle_story_threads_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_open_threads_updated_at on public.story_open_threads;
create trigger set_story_open_threads_updated_at
  before update on public.story_open_threads
  for each row execute function public.handle_story_threads_updated_at();

alter table public.story_open_threads enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'story_open_threads' and policyname = 'Admins read open threads'
  ) then
    create policy "Admins read open threads" on public.story_open_threads for select
      using (exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Story Chapters (Current Chapter)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_chapters (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  summary     text        not null default '',
  goal        text        not null default '',
  is_active   boolean     not null default false,
  started_at  date,
  ended_at    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Only one active chapter enforced via partial unique index
create unique index if not exists idx_story_chapters_one_active
  on public.story_chapters (is_active)
  where is_active = true;

-- Seed: The Restart
insert into public.story_chapters (title, summary, goal, is_active, started_at) values (
  'The Restart',
  'After spending approximately nine months building BudsAtWork.com, Bud OS, systems and infrastructure, Buds At Work is now focused on generating customers and proving the systems can produce real outcomes.',
  'Acquire consistent customers and validate the Growth & Marketing system.',
  true,
  current_date
) on conflict do nothing;

create or replace function public.handle_story_chapters_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_chapters_updated_at on public.story_chapters;
create trigger set_story_chapters_updated_at
  before update on public.story_chapters
  for each row execute function public.handle_story_chapters_updated_at();

alter table public.story_chapters enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'story_chapters' and policyname = 'Admins read story chapters'
  ) then
    create policy "Admins read story chapters" on public.story_chapters for select
      using (exists (
        select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
