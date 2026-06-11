-- Phase 2H.5: Story Opportunity Scoring
-- Adds deterministic story score and breakdown to story_opportunities.
-- Scored by the rule-based engine in src/lib/story/opportunity-scoring.ts.
-- Never auto-populated — must be explicitly triggered via API.

alter table public.story_opportunities
  add column if not exists story_score      integer,
  add column if not exists score_breakdown  jsonb,
  add column if not exists score_reason     text,
  add column if not exists scored_at        timestamptz;

-- Score must be 0–100 when present
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'story_opps_score_range'
      and table_name = 'story_opportunities'
  ) then
    alter table public.story_opportunities
      add constraint story_opps_score_range
        check (story_score is null or (story_score >= 0 and story_score <= 100));
  end if;
end $$;

create index if not exists idx_story_opps_score on public.story_opportunities (story_score desc nulls last);
