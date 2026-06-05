-- Phase 4A: Marketing Studio Publishing Queue
-- Manual bridge from Content Studio Production Cards to Marketing Studio publishing.
-- No social posting APIs, auto-posting, integrations, AI captions, agents, automations,
-- Campaign Manager, analytics, or Research Lab functionality.

create table if not exists public.marketing_publishing_queue (
  id                    uuid        primary key default gen_random_uuid(),
  title                 text        not null,

  production_card_id    uuid        not null references public.content_production_cards(id) on delete cascade,
  platform              text        not null check (platform in ('tiktok', 'instagram', 'facebook', 'youtube', 'linkedin', 'website')),
  format                text        not null default '',
  related_arc_id        uuid        references public.story_arcs(id) on delete set null,
  related_characters    text[]      not null default '{}',
  target_publish_at     timestamptz,

  status                text        not null default 'draft'
                                      check (status in ('draft', 'ready', 'published', 'archived')),
  caption_placeholder   text        not null default '',
  consent_verified      boolean     not null default false,
  notes                 text        not null default '',
  published_at          timestamptz,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint marketing_publishing_queue_consent_before_ready
    check (status not in ('ready', 'published') or consent_verified = true)
);

create index if not exists idx_marketing_publishing_queue_status     on public.marketing_publishing_queue (status);
create index if not exists idx_marketing_publishing_queue_platform   on public.marketing_publishing_queue (platform);
create index if not exists idx_marketing_publishing_queue_target     on public.marketing_publishing_queue (target_publish_at);
create index if not exists idx_marketing_publishing_queue_production on public.marketing_publishing_queue (production_card_id);
create index if not exists idx_marketing_publishing_queue_arc        on public.marketing_publishing_queue (related_arc_id);

-- updated_at trigger
create or replace function public.handle_marketing_publishing_queue_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_marketing_publishing_queue_updated_at on public.marketing_publishing_queue;
create trigger set_marketing_publishing_queue_updated_at
  before update on public.marketing_publishing_queue
  for each row execute function public.handle_marketing_publishing_queue_updated_at();

-- RLS: admin/owner only
alter table public.marketing_publishing_queue enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'marketing_publishing_queue' and policyname = 'Admins manage marketing publishing queue'
  ) then
    create policy "Admins manage marketing publishing queue"
      on public.marketing_publishing_queue for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
