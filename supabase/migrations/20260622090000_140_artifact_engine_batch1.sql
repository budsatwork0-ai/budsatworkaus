-- 140_artifact_engine_batch1.sql
-- Bud OS V4 Content System Transformation, Batch 1.
-- Adds structured Artifact Engine persistence and Campaign Factory run state.
-- Phase 1 explicitly excludes arbitrary generated HTML and downstream content creation.

create table if not exists public.artifacts (
  id                    uuid        primary key default gen_random_uuid(),
  type                  text        not null,
  title                 text        not null,
  summary               text        not null default '',
  status                text        not null default 'draft',
  score                 numeric,
  metadata              jsonb       not null default '{}'::jsonb,
  source_context        jsonb       not null default '{}'::jsonb,
  latest_version_id     uuid,
  approved_version_id   uuid,
  created_by            uuid        references auth.users(id) on delete set null,
  approved_by           uuid        references auth.users(id) on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint artifacts_type_check
    check (type in (
      'campaign',
      'research',
      'strategy',
      'story',
      'executive',
      'quote',
      'landing_page',
      'marketing',
      'dashboard',
      'storyboard'
    )),
  constraint artifacts_status_check
    check (status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  constraint artifacts_score_check
    check (score is null or (score >= 0 and score <= 100))
);

create table if not exists public.artifact_versions (
  id                 uuid        primary key default gen_random_uuid(),
  artifact_id        uuid        not null references public.artifacts(id) on delete cascade,
  version_number     integer     not null,
  schema_version     text        not null default 'artifact.v1',
  title              text        not null,
  summary            text        not null default '',
  content            jsonb       not null default '{}'::jsonb,
  plain_text         text,
  renderer           text        not null default 'structured_react',
  render_policy      jsonb       not null default '{"mode":"structured","allowHtml":false,"allowExternalAssets":false}'::jsonb,
  generation_input   jsonb       not null default '{}'::jsonb,
  generation_model   text,
  checksum           text        not null,
  created_by         uuid        references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),

  constraint artifact_versions_number_check
    check (version_number > 0),
  constraint artifact_versions_renderer_check
    check (renderer = 'structured_react'),
  constraint artifact_versions_render_policy_structured_check
    check (
      coalesce(render_policy->>'mode', '') = 'structured'
      and coalesce((render_policy->>'allowHtml')::boolean, false) = false
    ),
  unique (artifact_id, version_number)
);

alter table public.artifacts
  drop constraint if exists artifacts_latest_version_fk;
alter table public.artifacts
  add constraint artifacts_latest_version_fk
  foreign key (latest_version_id)
  references public.artifact_versions(id)
  on delete set null;

alter table public.artifacts
  drop constraint if exists artifacts_approved_version_fk;
alter table public.artifacts
  add constraint artifacts_approved_version_fk
  foreign key (approved_version_id)
  references public.artifact_versions(id)
  on delete set null;

create table if not exists public.campaign_factory_runs (
  id                            uuid        primary key default gen_random_uuid(),
  goal                          text        not null,
  title                         text        not null default '',
  status                        text        not null default 'draft',
  current_step                  text        not null default 'goal',
  selected_story_opportunity_id uuid        references public.story_opportunities(id) on delete set null,
  campaign_id                   uuid        references public.marketing_campaigns(id) on delete set null,
  signals                       jsonb       not null default '{}'::jsonb,
  research_summary              jsonb       not null default '{}'::jsonb,
  strategy                      jsonb       not null default '{}'::jsonb,
  approval_state                jsonb       not null default '{}'::jsonb,
  created_by                    uuid        references auth.users(id) on delete set null,
  approved_by                   uuid        references auth.users(id) on delete set null,
  approved_at                   timestamptz,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),

  constraint campaign_factory_runs_status_check
    check (status in ('draft', 'collecting_signals', 'researching', 'strategizing', 'artifact_review', 'approved', 'rejected', 'archived'))
);

create table if not exists public.campaign_factory_run_artifacts (
  run_id       uuid        not null references public.campaign_factory_runs(id) on delete cascade,
  artifact_id  uuid        not null references public.artifacts(id) on delete cascade,
  role         text        not null default 'primary',
  created_at   timestamptz not null default now(),
  primary key (run_id, artifact_id),
  constraint campaign_factory_run_artifacts_role_check
    check (role in ('primary', 'supporting', 'approved_output'))
);

create table if not exists public.content_library_items (
  id              uuid        primary key default gen_random_uuid(),
  item_type       text        not null,
  source_table    text        not null,
  source_id       uuid        not null,
  title           text        not null,
  summary         text        not null default '',
  campaign_id     uuid        references public.marketing_campaigns(id) on delete set null,
  artifact_id     uuid        references public.artifacts(id) on delete set null,
  platform        text,
  status          text        not null,
  tags            text[]      not null default '{}',
  performance     jsonb       not null default '{}'::jsonb,
  searchable_text text        not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_table, source_id)
);

create index if not exists idx_artifacts_type on public.artifacts(type);
create index if not exists idx_artifacts_status on public.artifacts(status);
create index if not exists idx_artifacts_score on public.artifacts(score desc nulls last);
create index if not exists idx_artifacts_created_at on public.artifacts(created_at desc);

create index if not exists idx_artifact_versions_artifact on public.artifact_versions(artifact_id);
create index if not exists idx_artifact_versions_created_at on public.artifact_versions(created_at desc);

create index if not exists idx_campaign_factory_runs_status on public.campaign_factory_runs(status);
create index if not exists idx_campaign_factory_runs_goal on public.campaign_factory_runs(goal);
create index if not exists idx_campaign_factory_runs_story on public.campaign_factory_runs(selected_story_opportunity_id);
create index if not exists idx_campaign_factory_runs_created_at on public.campaign_factory_runs(created_at desc);
create index if not exists idx_campaign_factory_run_artifacts_artifact on public.campaign_factory_run_artifacts(artifact_id);

create index if not exists idx_content_library_items_type on public.content_library_items(item_type);
create index if not exists idx_content_library_items_status on public.content_library_items(status);
create index if not exists idx_content_library_items_campaign on public.content_library_items(campaign_id);
create index if not exists idx_content_library_items_artifact on public.content_library_items(artifact_id);
create index if not exists idx_content_library_items_platform on public.content_library_items(platform);
create index if not exists idx_content_library_items_created_at on public.content_library_items(created_at desc);
create index if not exists idx_content_library_items_tags on public.content_library_items using gin(tags);
create index if not exists idx_content_library_items_search on public.content_library_items using gin(to_tsvector('english', searchable_text));

create or replace function public.handle_artifacts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_artifacts_updated_at on public.artifacts;
create trigger set_artifacts_updated_at
  before update on public.artifacts
  for each row execute function public.handle_artifacts_updated_at();

create or replace function public.handle_campaign_factory_runs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_campaign_factory_runs_updated_at on public.campaign_factory_runs;
create trigger set_campaign_factory_runs_updated_at
  before update on public.campaign_factory_runs
  for each row execute function public.handle_campaign_factory_runs_updated_at();

create or replace function public.handle_content_library_items_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_library_items_updated_at on public.content_library_items;
create trigger set_content_library_items_updated_at
  before update on public.content_library_items
  for each row execute function public.handle_content_library_items_updated_at();

alter table public.artifacts enable row level security;
alter table public.artifact_versions enable row level security;
alter table public.campaign_factory_runs enable row level security;
alter table public.campaign_factory_run_artifacts enable row level security;
alter table public.content_library_items enable row level security;

drop policy if exists "Admins manage artifacts" on public.artifacts;
create policy "Admins manage artifacts"
  on public.artifacts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins manage artifact versions" on public.artifact_versions;
create policy "Admins manage artifact versions"
  on public.artifact_versions for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins manage campaign factory runs" on public.campaign_factory_runs;
create policy "Admins manage campaign factory runs"
  on public.campaign_factory_runs for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins manage campaign factory run artifacts" on public.campaign_factory_run_artifacts;
create policy "Admins manage campaign factory run artifacts"
  on public.campaign_factory_run_artifacts for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));

drop policy if exists "Admins manage content library items" on public.content_library_items;
create policy "Admins manage content library items"
  on public.content_library_items for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));
