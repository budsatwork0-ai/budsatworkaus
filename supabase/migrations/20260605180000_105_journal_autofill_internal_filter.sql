-- Phase 6B: Journal quick capture + reviewed story suggestions + internal opportunity filter.

alter table public.founder_journal_entries
  add column if not exists raw_capture text,
  add column if not exists suggested_story_bible_note text,
  add column if not exists suggested_character_timeline_entry text,
  add column if not exists suggested_arc_update text,
  add column if not exists suggested_open_thread_update text;

alter table public.story_opportunities
  drop constraint if exists story_opportunities_source_type_check;

alter table public.story_opportunities
  add constraint story_opportunities_source_type_check
    check (source_type in (
      'journal',
      'character',
      'arc',
      'open_thread',
      'chapter',
      'manual',
      'milestone',
      'internal_system_milestone'
    ));
