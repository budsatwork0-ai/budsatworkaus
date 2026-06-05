import { describe, expect, it } from 'vitest';
import { organiseJournalCapture } from '@/lib/story/journal-autofill';
import type { JournalEntryDraft } from '@/types/journal';

function draft(raw: string): JournalEntryDraft {
  return {
    entry_date: '2026-06-06',
    raw_capture: raw,
    wins: '',
    challenges: '',
    customer_activity: '',
    silvan_updates: '',
    business_progress: '',
    bud_os_progress: '',
    memorable_moments: '',
    lessons_learned: '',
    content_potential_notes: '',
    media_references: '',
    tags: [],
    content_potential_rating: 'none',
    arc_connections: [],
    suggested_story_bible_note: '',
    suggested_character_timeline_entry: '',
    suggested_arc_update: '',
    suggested_open_thread_update: '',
  };
}

describe('journal autofill', () => {
  it('preserves raw capture and organises public customer signals', () => {
    const result = organiseJournalCapture(draft(
      'We got our first customer booking today and sent a quote. Silvan handled the shift well. I learned the pipeline needs to be simpler.',
    ));

    expect(result.raw_capture).toContain('first customer booking');
    expect(result.customer_activity).toContain('first customer booking');
    expect(result.silvan_updates).toContain('Silvan');
    expect(result.lessons_learned).toContain('learned');
    expect(result.content_potential_rating).toBe('high');
    expect(result.tags).toContain('customer');
    expect(result.arc_connections).toContain('From idea to paying customers');
    expect(result.suggested_story_bible_note).toContain('Potential Story Bible note');
  });

  it('keeps internal system updates private unless impact is present', () => {
    const result = organiseJournalCapture(draft(
      'The automation layer changed the crew theme colour and write_theme_file updated the dashboard UI.',
    ));

    expect(result.content_potential_rating).toBe('none');
    expect(result.content_potential_notes).toContain('Private/internal system record');
    expect(result.suggested_story_bible_note).toBeNull();
  });
});
