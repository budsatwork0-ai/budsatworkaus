-- Phase 2F: Story Drafts
-- Stores AI-generated and manually edited content drafts linked to Story Opportunities.
-- Admin-only. No auto-publishing. All drafts require human review.

create table if not exists public.story_drafts (
  id                  uuid        primary key default gen_random_uuid(),
  opportunity_id      uuid        not null references public.story_opportunities(id) on delete cascade,

  -- Content format metadata
  format              text        not null default '',
  platform            text        not null default '',

  -- Draft content sections
  hook                text        not null default '',
  body                text        not null default '',
  close               text        not null default '',
  hashtags            text[]      not null default '{}',

  -- Generation provenance
  prompt_context      text        not null default '',
  is_ai_generated     boolean     not null default true,
  generation_model    text,
  generation_tokens   integer,

  -- Workflow status
  status              text        not null default 'draft'
                                  check (status in ('draft', 'reviewed', 'approved', 'archived')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_story_drafts_opp    on public.story_drafts (opportunity_id);
create index if not exists idx_story_drafts_status on public.story_drafts (status);

-- updated_at trigger
create or replace function public.handle_story_drafts_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_drafts_updated_at on public.story_drafts;
create trigger set_story_drafts_updated_at
  before update on public.story_drafts
  for each row execute function public.handle_story_drafts_updated_at();

-- RLS: admin/owner only
alter table public.story_drafts enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'story_drafts' and policyname = 'Admins manage story drafts'
  ) then
    create policy "Admins manage story drafts"
      on public.story_drafts for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
