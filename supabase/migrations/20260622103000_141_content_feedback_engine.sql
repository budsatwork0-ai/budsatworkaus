-- 141_content_feedback_engine.sql
-- Bud OS V4 Content System Transformation, Batch 5.
-- Adds the minimal human-reviewed learning layer for content outcomes.
-- No publishing, scheduling, social automation, or separate analytics platform.

alter table public.artifacts
  drop constraint if exists artifacts_type_check;

alter table public.artifacts
  add constraint artifacts_type_check
    check (type in (
      'campaign',
      'research',
      'strategy',
      'story',
      'learning',
      'executive',
      'quote',
      'landing_page',
      'marketing',
      'dashboard',
      'storyboard'
    ));

create table if not exists public.content_learning_records (
  id                         uuid        primary key default gen_random_uuid(),
  campaign_factory_run_id    uuid        references public.campaign_factory_runs(id) on delete set null,
  campaign_id                uuid        references public.marketing_campaigns(id) on delete set null,
  learning_artifact_id       uuid        references public.artifacts(id) on delete set null,
  goal                       text        not null,
  campaign_title             text        not null,
  source_artifact_ids        uuid[]      not null default '{}',
  source_library_item_ids    uuid[]      not null default '{}',
  outcome_score              jsonb       not null default '{}'::jsonb,
  results                    jsonb       not null default '{}'::jsonb,
  what_worked                jsonb       not null default '[]'::jsonb,
  what_failed                jsonb       not null default '[]'::jsonb,
  supporting_evidence        jsonb       not null default '[]'::jsonb,
  recommended_future_actions jsonb       not null default '[]'::jsonb,
  confidence                 numeric     not null default 0,
  confidence_reason          text        not null default '',
  status                     text        not null default 'draft',
  reviewed_by                uuid        references auth.users(id) on delete set null,
  reviewed_at                timestamptz,
  created_by                 uuid        references auth.users(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint content_learning_records_status_check
    check (status in ('draft', 'in_review', 'approved', 'rejected', 'archived')),
  constraint content_learning_records_confidence_check
    check (confidence >= 0 and confidence <= 100)
);

create index if not exists idx_content_learning_records_goal
  on public.content_learning_records(goal);
create index if not exists idx_content_learning_records_status
  on public.content_learning_records(status);
create index if not exists idx_content_learning_records_run
  on public.content_learning_records(campaign_factory_run_id);
create index if not exists idx_content_learning_records_campaign
  on public.content_learning_records(campaign_id);
create index if not exists idx_content_learning_records_artifact
  on public.content_learning_records(learning_artifact_id);
create index if not exists idx_content_learning_records_source_artifacts
  on public.content_learning_records using gin(source_artifact_ids);
create index if not exists idx_content_learning_records_created_at
  on public.content_learning_records(created_at desc);

create or replace function public.handle_content_learning_records_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_content_learning_records_updated_at on public.content_learning_records;
create trigger set_content_learning_records_updated_at
  before update on public.content_learning_records
  for each row execute function public.handle_content_learning_records_updated_at();

alter table public.content_learning_records enable row level security;

drop policy if exists "Admins manage content learning records" on public.content_learning_records;
create policy "Admins manage content learning records"
  on public.content_learning_records for all
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ));
