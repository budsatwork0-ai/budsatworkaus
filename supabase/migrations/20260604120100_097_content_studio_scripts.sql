-- Phase 3B-lite: Content Studio Scripts
-- Manual scripts linked to Content Ideas.
-- No production board, asset library, publishing queue, AI generation, agents, or automations.

create table if not exists public.content_scripts (
  id              uuid        primary key default gen_random_uuid(),
  idea_id         uuid        not null references public.content_ideas(id) on delete cascade,

  -- Manual script sections
  hook            text        not null default '',
  setup           text        not null default '',
  core_moment     text        not null default '',
  close_cta       text        not null default '',

  -- Content metadata copied or refined from the linked idea
  platform        text        not null default '',
  format          text        not null default '',

  -- Only approved scripts may enter a future Production Board.
  status          text        not null default 'draft'
                              check (status in ('draft', 'approved', 'archived')),
  notes           text        not null default '',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_content_scripts_idea   on public.content_scripts (idea_id);
create index if not exists idx_content_scripts_status on public.content_scripts (status);
create index if not exists idx_content_scripts_created on public.content_scripts (created_at desc);

-- updated_at trigger
create or replace function public.handle_content_scripts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_scripts_updated_at on public.content_scripts;
create trigger set_content_scripts_updated_at
  before update on public.content_scripts
  for each row execute function public.handle_content_scripts_updated_at();

-- RLS: admin/owner only
alter table public.content_scripts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_scripts' and policyname = 'Admins manage content scripts'
  ) then
    create policy "Admins manage content scripts"
      on public.content_scripts for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
