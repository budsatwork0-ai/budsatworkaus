-- Phase 2E: Story Opportunity Detection
-- Adds detection metadata to story_opportunities.
-- source_hash provides duplicate protection — same event cannot create two opportunities.

alter table public.story_opportunities
  add column if not exists is_auto_detected  boolean  not null default false,
  add column if not exists detection_rule    text,
  add column if not exists detection_reason  text,
  add column if not exists confidence_score  float,
  add column if not exists source_hash       text;

-- Confidence must be between 0 and 1 when present
do $$ begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'story_opps_confidence_range'
      and table_name = 'story_opportunities'
  ) then
    alter table public.story_opportunities
      add constraint story_opps_confidence_range
        check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1));
  end if;
end $$;

-- Partial unique index on source_hash: same hash cannot appear twice
-- Allows multiple null values (manual opportunities have no hash)
create unique index if not exists idx_story_opps_source_hash
  on public.story_opportunities (source_hash)
  where source_hash is not null;

-- Extend source_type to include 'milestone' for business event detections
-- Drop existing check constraint and recreate it with the new value
alter table public.story_opportunities
  drop constraint if exists story_opportunities_source_type_check;

alter table public.story_opportunities
  add constraint story_opportunities_source_type_check
    check (source_type in (
      'journal', 'character', 'arc', 'open_thread', 'chapter', 'manual', 'milestone'
    ));
