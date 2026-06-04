export type ContentPotentialRating = 'none' | 'low' | 'medium' | 'high';

export interface JournalEntry {
  id: string;
  entry_date: string; // ISO date YYYY-MM-DD
  wins: string | null;
  challenges: string | null;
  customer_activity: string | null;
  silvan_updates: string | null;
  business_progress: string | null;
  bud_os_progress: string | null;
  memorable_moments: string | null;
  lessons_learned: string | null;
  content_potential_notes: string | null;
  media_references: string | null;
  tags: string[];
  content_potential_rating: ContentPotentialRating;
  arc_connections: string[];
  story_opportunity_created: boolean;
  created_at: string;
  updated_at: string;
}

export type JournalEntryDraft = Omit<
  JournalEntry,
  'id' | 'story_opportunity_created' | 'created_at' | 'updated_at'
>;

export const JOURNAL_SECTIONS = [
  { key: 'wins',                    label: "Today's Wins",               rows: 4, placeholder: "What went well today? Bookings, conversations, moments that mattered." },
  { key: 'challenges',              label: "Today's Challenges",         rows: 4, placeholder: "What was hard? What didn't work? Be honest — this is the source material." },
  { key: 'customer_activity',       label: "Customer Activity",          rows: 3, placeholder: "Enquiries, quotes sent, bookings confirmed, jobs completed, feedback received." },
  { key: 'silvan_updates',          label: "Silvan Updates",             rows: 3, placeholder: "Shifts, skills, moments of progress. What do you want to remember from today?" },
  { key: 'business_progress',       label: "Business Progress",          rows: 3, placeholder: "Revenue, pipeline, operational milestones. Where is the business right now?" },
  { key: 'bud_os_progress',         label: "Bud OS Progress",            rows: 3, placeholder: "What did you build, fix, or discover in the systems today?" },
  { key: 'memorable_moments',       label: "Funny / Memorable Moments",  rows: 2, placeholder: "The small things worth remembering. A customer reaction, something unexpected." },
  { key: 'lessons_learned',         label: "Lessons Learned",            rows: 3, placeholder: "What would you tell yourself from yesterday? What changed your thinking?" },
  { key: 'content_potential_notes', label: "Content Potential",          rows: 3, placeholder: "What from today could become content? A story angle, a moment, a thread to continue." },
  { key: 'media_references',        label: "Photos / Videos Referenced", rows: 2, placeholder: "Links or descriptions of photos and videos captured today." },
] as const;

export type JournalSectionKey = (typeof JOURNAL_SECTIONS)[number]['key'];

export const CONTENT_POTENTIAL_LABELS: Record<ContentPotentialRating, string> = {
  none:   'None',
  low:    'Low',
  medium: 'Medium',
  high:   'High — story opportunity',
};

export const CONTENT_POTENTIAL_STYLES: Record<ContentPotentialRating, { bg: string; fg: string }> = {
  none:   { bg: '#F1F5F9', fg: '#475569' },
  low:    { bg: '#EFF6FF', fg: '#1D4ED8' },
  medium: { bg: '#FFFBEB', fg: '#B45309' },
  high:   { bg: '#ECFDF5', fg: '#047857' },
};
