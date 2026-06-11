-- Phase 3D: Content Studio Asset Library
-- Manual asset tracking with links/paths only.
-- No file storage, publishing queue, marketing integration, AI generation, agents, or automations.

create table if not exists public.content_assets (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,

  asset_type          text        not null default 'other'
                                  check (asset_type in ('footage', 'photo', 'graphic', 'testimonial', 'other')),
  source_url          text        not null default '',

  production_card_id  uuid        references public.content_production_cards(id) on delete set null,
  idea_id             uuid        references public.content_ideas(id) on delete set null,
  script_id           uuid        references public.content_scripts(id) on delete set null,

  consent_status      text        not null default 'unknown'
                                  check (consent_status in ('unknown', 'not_required', 'pending', 'confirmed', 'denied')),
  related_characters  text[]      not null default '{}',
  related_customer    text        not null default '',
  notes               text        not null default '',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint content_assets_denied_not_in_production
    check (consent_status <> 'denied' or production_card_id is null)
);

create index if not exists idx_content_assets_type       on public.content_assets (asset_type);
create index if not exists idx_content_assets_consent    on public.content_assets (consent_status);
create index if not exists idx_content_assets_production on public.content_assets (production_card_id);
create index if not exists idx_content_assets_idea       on public.content_assets (idea_id);
create index if not exists idx_content_assets_script     on public.content_assets (script_id);

-- updated_at trigger
create or replace function public.handle_content_assets_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_assets_updated_at on public.content_assets;
create trigger set_content_assets_updated_at
  before update on public.content_assets
  for each row execute function public.handle_content_assets_updated_at();

-- RLS: admin/owner only
alter table public.content_assets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'content_assets' and policyname = 'Admins manage content assets'
  ) then
    create policy "Admins manage content assets"
      on public.content_assets for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
