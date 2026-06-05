-- Phase 3C: Content Studio Production Board
-- Manual production tracking for approved scripts.
-- No asset library, publishing queue, AI generation, agents, or automations.

create table if not exists public.content_production_cards (
  id                  uuid        primary key default gen_random_uuid(),
  script_id           uuid        not null references public.content_scripts(id) on delete cascade,

  title               text        not null,
  platform            text        not null default '',
  format              text        not null default '',
  related_arc_id      uuid        references public.story_arcs(id) on delete set null,
  related_characters  text[]      not null default '{}',
  deadline            date,

  status              text        not null default 'to_film'
                                      check (status in ('to_film', 'in_edit', 'ready_to_publish', 'published')),
  notes               text        not null default '',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_content_production_cards_script   on public.content_production_cards (script_id);
create index if not exists idx_content_production_cards_status   on public.content_production_cards (status);
create index if not exists idx_content_production_cards_deadline on public.content_production_cards (deadline);
create index if not exists idx_content_production_cards_arc      on public.content_production_cards (related_arc_id);

-- updated_at trigger
create or replace function public.handle_content_production_cards_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_production_cards_updated_at on public.content_production_cards;
create trigger set_content_production_cards_updated_at
  before update on public.content_production_cards
  for each row execute function public.handle_content_production_cards_updated_at();

-- RLS: admin/owner only
alter table public.content_production_cards enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_production_cards' and policyname = 'Admins manage content production cards'
  ) then
    create policy "Admins manage content production cards"
      on public.content_production_cards for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
