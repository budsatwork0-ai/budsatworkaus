-- Phase 2A: Founder Journal
-- The daily capture layer for the Story Engine.
-- Private, admin-only. Writes via service role (bypasses RLS). Reads via RLS policy.

create table if not exists public.founder_journal_entries (
  id                          uuid        primary key default gen_random_uuid(),
  entry_date                  date        not null default current_date,

  -- 10 journal sections (all nullable — partial entries are valid)
  wins                        text,        -- Today's Wins
  challenges                  text,        -- Today's Challenges
  customer_activity           text,        -- Customer Activity
  silvan_updates              text,        -- Silvan Updates
  business_progress           text,        -- Business Progress
  bud_os_progress             text,        -- Bud OS Progress
  memorable_moments           text,        -- Funny / Memorable Moments
  lessons_learned             text,        -- Lessons Learned
  content_potential_notes     text,        -- Content Potential (notes on what could become content)
  media_references            text,        -- Photos / Videos Referenced (links or descriptions)

  -- Metadata
  tags                        text[]      not null default '{}',
  content_potential_rating    text        not null default 'none'
                                          check (content_potential_rating in ('none', 'low', 'medium', 'high')),

  -- Future Story Engine integration hooks (populated in Phase 2B+)
  arc_connections             text[]      not null default '{}',
  story_opportunity_created   boolean     not null default false,

  -- Audit
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Unique constraint: one entry per calendar day
create unique index if not exists idx_journal_entries_date_unique
  on public.founder_journal_entries (entry_date);

-- Performance indexes
create index if not exists idx_journal_entries_date
  on public.founder_journal_entries (entry_date desc);

create index if not exists idx_journal_entries_rating
  on public.founder_journal_entries (content_potential_rating);

create index if not exists idx_journal_entries_tags
  on public.founder_journal_entries using gin (tags);

-- updated_at trigger (reuse existing function if present, otherwise create)
create or replace function public.handle_journal_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_founder_journal_entries_updated_at on public.founder_journal_entries;
create trigger set_founder_journal_entries_updated_at
  before update on public.founder_journal_entries
  for each row execute function public.handle_journal_updated_at();

-- RLS: private to admin/owner roles
alter table public.founder_journal_entries enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'founder_journal_entries'
      and policyname = 'Admins read journal entries'
  ) then
    create policy "Admins read journal entries"
      on public.founder_journal_entries
      for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.role in ('admin', 'owner')
        )
      );
  end if;
end $$;
