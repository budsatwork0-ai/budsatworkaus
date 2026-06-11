-- 108_journal_suggestion_tracking.sql
-- Adds apply/skip tracking to journal entry suggestions.
-- Adds timeline_notes to story_characters (target for character timeline suggestions).
-- Adds progress_notes to story_open_threads (mirrors story_arcs, target for thread suggestions).

-- ── story_characters ─────────────────────────────────────────────────────────
alter table public.story_characters
  add column if not exists timeline_notes text;

-- ── story_open_threads ───────────────────────────────────────────────────────
alter table public.story_open_threads
  add column if not exists progress_notes text;

-- ── founder_journal_entries ──────────────────────────────────────────────────
-- Status per suggestion: 'pending' | 'applied' | 'skipped'
alter table public.founder_journal_entries
  add column if not exists suggestion_story_bible_status        text default 'pending',
  add column if not exists suggestion_character_timeline_status text default 'pending',
  add column if not exists suggestion_arc_status                text default 'pending',
  add column if not exists suggestion_open_thread_status        text default 'pending';

-- Target records — section_key (text) for bible, uuid for the rest
alter table public.founder_journal_entries
  add column if not exists suggestion_story_bible_target        text,
  add column if not exists suggestion_character_timeline_target uuid,
  add column if not exists suggestion_arc_target                uuid,
  add column if not exists suggestion_open_thread_target        uuid;
