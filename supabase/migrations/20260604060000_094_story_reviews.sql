-- Phase 2G: Story Safety & Approval Layer
-- Stores safety review records for story drafts.
-- All publish decisions require human approval.

create table if not exists public.story_reviews (
  id                        uuid        primary key default gen_random_uuid(),
  draft_id                  uuid        not null references public.story_drafts(id) on delete cascade,
  review_status             text        not null default 'pending_review'
                                        check (review_status in ('pending_review', 'changes_required', 'approved', 'rejected')),
  safety_score              integer     not null default 0 check (safety_score >= 0 and safety_score <= 100),
  consent_verified          boolean     not null default false,
  privacy_checked           boolean     not null default false,
  factual_accuracy_checked  boolean     not null default false,
  brand_alignment_checked   boolean     not null default false,
  findings                  jsonb       not null default '[]',
  reviewer_notes            text        not null default '',
  reviewed_by               uuid        references auth.users(id),
  reviewed_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_story_reviews_draft  on public.story_reviews (draft_id);
create index if not exists idx_story_reviews_status on public.story_reviews (review_status);

create or replace function public.handle_story_reviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists set_story_reviews_updated_at on public.story_reviews;
create trigger set_story_reviews_updated_at
  before update on public.story_reviews
  for each row execute function public.handle_story_reviews_updated_at();

alter table public.story_reviews enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'story_reviews' and policyname = 'Admins manage story reviews'
  ) then
    create policy "Admins manage story reviews"
      on public.story_reviews for all
      using (exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role in ('admin', 'owner')
      ));
  end if;
end $$;
