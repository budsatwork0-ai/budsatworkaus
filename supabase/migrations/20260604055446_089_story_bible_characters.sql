-- Phase 2B-lite: Story Bible + Characters
-- Both tables are admin-only, manual edit only. No AI writes.

-- ─────────────────────────────────────────────────────────────
-- Story Bible: one row per named section
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_bible_sections (
  id           uuid        primary key default gen_random_uuid(),
  section_key  text        not null unique,
  content      text        not null default '',
  updated_at   timestamptz not null default now(),
  updated_by   text        not null default 'Jackson Taylor'
);

-- Seed the 7 sections (empty content — Jackson fills them in)
insert into public.story_bible_sections (section_key) values
  ('mission_purpose'),
  ('core_tension'),
  ('narrative_tone'),
  ('what_we_show'),
  ('what_we_never_do'),
  ('the_long_arc'),
  ('current_narrative_notes')
on conflict (section_key) do nothing;

-- updated_at trigger
create or replace function public.handle_story_bible_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_story_bible_sections_updated_at on public.story_bible_sections;
create trigger set_story_bible_sections_updated_at
  before update on public.story_bible_sections
  for each row execute function public.handle_story_bible_updated_at();

-- RLS: admin/owner only
alter table public.story_bible_sections enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'story_bible_sections'
      and policyname = 'Admins read story bible'
  ) then
    create policy "Admins read story bible"
      on public.story_bible_sections for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'owner')
        )
      );
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Story Characters: three fixed rows (Jackson, Silvan, Buds At Work)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.story_characters (
  id                   uuid        primary key default gen_random_uuid(),
  slug                 text        not null unique,
  name                 text        not null,

  -- narrative profile fields (all nullable — partial records are valid)
  profile              text        not null default '',
  role_in_story        text        not null default '',
  voice_perspective    text        not null default '',
  content_posture      text        not null default '',
  what_to_show         text        not null default '',
  what_to_protect      text        not null default '',
  active_story_threads text        not null default '',

  -- consent gate — applicable to Silvan; null for other characters
  consent_status       text,
  consent_notes        text,

  updated_at           timestamptz not null default now()
);

-- Seed three characters
insert into public.story_characters (slug, name) values
  ('jackson-taylor', 'Jackson Taylor'),
  ('silvan',         'Silvan'),
  ('buds-at-work',   'Buds At Work')
on conflict (slug) do nothing;

-- updated_at trigger
create or replace function public.handle_story_characters_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_story_characters_updated_at on public.story_characters;
create trigger set_story_characters_updated_at
  before update on public.story_characters
  for each row execute function public.handle_story_characters_updated_at();

-- RLS: admin/owner only
alter table public.story_characters enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'story_characters'
      and policyname = 'Admins read story characters'
  ) then
    create policy "Admins read story characters"
      on public.story_characters for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.role in ('admin', 'owner')
        )
      );
  end if;
end $$;
