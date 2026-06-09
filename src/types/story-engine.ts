// ─── Story Opportunities ──────────────────────────────────────────────────────

export type OpportunityStatus = 'new' | 'in_development' | 'published' | 'passed';
export type OpportunitySourceType = 'journal' | 'character' | 'arc' | 'open_thread' | 'chapter' | 'manual' | 'milestone' | 'internal_system_milestone';
export type OpportunitySection = 'surfaced' | 'tension_map' | 'missed_moments';

export type StoryCategory =
  | 'employment_outcome'
  | 'customer_validation'
  | 'community_impact'
  | 'business_milestone'
  | 'founder_journey'
  | 'internal_operations';

export const STORY_CATEGORY_LABELS: Record<StoryCategory, string> = {
  employment_outcome:  'Employment Outcome',
  customer_validation: 'Customer Validation',
  community_impact:    'Community Impact',
  business_milestone:  'Business Milestone',
  founder_journey:     'Founder Journey',
  internal_operations: 'Internal Operations',
};

export interface ScoreBreakdown {
  human_impact:             number;
  business_significance:    number;
  emotional_tension:        number;
  transformation_potential: number;
  content_potential:        number;
  reasons:                  string[];
}

export interface StoryOpportunity {
  id: string;
  title: string;
  source_type: OpportunitySourceType;
  source_ref_id: string | null;
  related_arc_id: string | null;
  related_characters: string[];
  content_angle: string;
  suggested_format: string;
  suggested_platform: string;
  priority: number;
  status: OpportunityStatus;
  section: OpportunitySection;
  notes: string;
  // Detection metadata (Phase 2E)
  is_auto_detected: boolean;
  detection_rule: string | null;
  detection_reason: string | null;
  confidence_score: number | null;
  source_hash: string | null;
  // Story Score (Phase 2H.5 / v2)
  story_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  score_reason: string | null;
  scored_at: string | null;
  story_category: StoryCategory | null;
  created_at: string;
  updated_at: string;
  // Computed by GET /api/story-opportunities — not stored in DB
  draft_count?: number;
}

export type StorySortKey = 'story_score' | 'newest' | 'priority';

export const STORY_SCORE_TIERS: Array<{
  min: number; max: number; label: string; bg: string; fg: string;
}> = [
  { min: 80, max: 100, label: 'Legendary', bg: '#FDF4FF', fg: '#7E22CE' },
  { min: 60, max:  79, label: 'High',      bg: '#ECFDF5', fg: '#047857' },
  { min: 40, max:  59, label: 'Strong',    bg: '#EFF6FF', fg: '#1D4ED8' },
  { min: 20, max:  39, label: 'Moderate',  bg: '#FFFBEB', fg: '#B45309' },
  { min:  0, max:  19, label: 'Low',       bg: '#FEF2F2', fg: '#B91C1C' },
];

export function getScoreTier(score: number) {
  return STORY_SCORE_TIERS.find((t) => score >= t.min && score <= t.max) ?? STORY_SCORE_TIERS[4];
}

export type DetectionSummary = {
  created: number;
  skipped: number;
  errors: string[];
  breakdown: Record<string, { created: number; skipped: number }>;
};

export const OPP_STATUS_STYLES: Record<OpportunityStatus, { bg: string; fg: string; label: string }> = {
  new:            { bg: '#ECFDF5', fg: '#047857', label: 'New' },
  in_development: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'In Development' },
  published:      { bg: '#F1F5F9', fg: '#475569', label: 'Published' },
  passed:         { bg: '#FEF2F2', fg: '#B91C1C', label: 'Passed' },
};

export const OPP_STATUSES: OpportunityStatus[] = ['new', 'in_development', 'published', 'passed'];

export const OPP_SOURCE_LABELS: Record<OpportunitySourceType, string> = {
  journal:     'Journal Entry',
  character:   'Character',
  arc:         'Story Arc',
  open_thread: 'Open Thread',
  chapter:     'Chapter',
  manual:      'Manual',
  milestone:   'Business Milestone',
  internal_system_milestone: 'Internal System Milestone',
};

export const OPP_SECTIONS: { key: OpportunitySection; label: string; description: string }[] = [
  {
    key: 'surfaced',
    label: 'Surfaced',
    description: 'Content angles with clear story grounding — moments ready to develop.',
  },
  {
    key: 'tension_map',
    label: 'Tension Map',
    description: 'Moments of conflict, friction, or dramatic tension worth exploring.',
  },
  {
    key: 'missed_moments',
    label: 'Missed Moments',
    description: 'Story moments that happened but were not captured as content at the time.',
  },
];

export const SUGGESTED_FORMATS = [
  'Reel', 'Story', 'Photo post', 'Carousel', 'Long-form video',
  'Short video', 'Tweet / Thread', 'Newsletter', 'Blog post', 'Podcast', 'Other',
];

export const SUGGESTED_PLATFORMS = [
  'Instagram', 'TikTok', 'LinkedIn', 'Facebook', 'Email', 'Blog', 'YouTube', 'Twitter / X', 'Other',
];

// ─── Story Arcs ───────────────────────────────────────────────────────────────

export type ArcStatus = 'active' | 'planted' | 'resolved' | 'abandoned';

export interface StoryArc {
  id: string;
  title: string;
  description: string;
  status: ArcStatus;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  characters_involved: string[];
  journal_entry_links: string[];
  progress_notes: string;
  created_at: string;
  updated_at: string;
}

export const ARC_STATUS_STYLES: Record<ArcStatus, { bg: string; fg: string; label: string }> = {
  active:    { bg: '#ECFDF5', fg: '#047857', label: 'Active' },
  planted:   { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Planted' },
  resolved:  { bg: '#F1F5F9', fg: '#475569', label: 'Resolved' },
  abandoned: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Abandoned' },
};

export const ARC_STATUSES: ArcStatus[] = ['active', 'planted', 'resolved', 'abandoned'];

// ─── Open Threads ─────────────────────────────────────────────────────────────

export type ThreadStatus = 'open' | 'resolved' | 'abandoned';

export interface StoryOpenThread {
  id: string;
  title: string;
  description: string;
  related_arc_id: string | null;
  related_characters: string[];
  status: ThreadStatus;
  opened_date: string;
  closed_date: string | null;
  created_at: string;
  updated_at: string;
}

export const THREAD_STATUS_STYLES: Record<ThreadStatus, { bg: string; fg: string; label: string }> = {
  open:      { bg: '#FFFBEB', fg: '#B45309', label: 'Open' },
  resolved:  { bg: '#ECFDF5', fg: '#047857', label: 'Resolved' },
  abandoned: { bg: '#F1F5F9', fg: '#475569', label: 'Abandoned' },
};

export const THREAD_STATUSES: ThreadStatus[] = ['open', 'resolved', 'abandoned'];

// ─── Story Chapters ───────────────────────────────────────────────────────────

export interface StoryChapter {
  id: string;
  title: string;
  summary: string;
  goal: string;
  is_active: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Story Bible ──────────────────────────────────────────────────────────────

export type StoryBibleSectionKey =
  | 'mission_purpose'
  | 'core_tension'
  | 'narrative_tone'
  | 'what_we_show'
  | 'what_we_never_do'
  | 'the_long_arc'
  | 'current_narrative_notes';

export interface StoryBibleSection {
  id: string;
  section_key: StoryBibleSectionKey;
  content: string;
  updated_at: string;
  updated_by: string;
}

export const STORY_BIBLE_SECTIONS: {
  key: StoryBibleSectionKey;
  title: string;
  description: string;
  placeholder: string;
  rows: number;
}[] = [
  {
    key: 'mission_purpose',
    title: 'Mission & Purpose',
    description: 'Why Buds At Work exists. The deeper purpose beneath the service.',
    placeholder: 'Write the mission and purpose here…',
    rows: 5,
  },
  {
    key: 'core_tension',
    title: 'Core Tension',
    description: 'The central conflict or challenge the story is built around.',
    placeholder: 'What is the core tension driving the narrative?',
    rows: 4,
  },
  {
    key: 'narrative_tone',
    title: 'Narrative Tone',
    description: 'How the story sounds. Voice, register, emotional temperature.',
    placeholder: 'Describe the tone: honest, warm, direct, ambitious, grounded…',
    rows: 4,
  },
  {
    key: 'what_we_show',
    title: 'What We Show',
    description: 'The things we intentionally make visible. The real work, the people, the process.',
    placeholder: 'What does Buds At Work choose to show its audience?',
    rows: 5,
  },
  {
    key: 'what_we_never_do',
    title: 'What We Never Do',
    description: 'Hard constraints. What Buds At Work will not show, not say, and not become.',
    placeholder: 'What are the lines we never cross in our storytelling?',
    rows: 5,
  },
  {
    key: 'the_long_arc',
    title: 'The Long Arc',
    description: 'The overarching narrative across years. The story we are building toward.',
    placeholder: 'What is the long arc of the Buds At Work story?',
    rows: 5,
  },
  {
    key: 'current_narrative_notes',
    title: 'Current Narrative Notes',
    description: 'Timely notes on where the story is right now. Updated as the chapter progresses.',
    placeholder: 'What is happening in the story right now? What themes are active?',
    rows: 6,
  },
];

// ─── Characters ───────────────────────────────────────────────────────────────

export type CharacterSlug = 'jackson-taylor' | 'silvan' | 'buds-at-work';

export interface StoryCharacter {
  id: string;
  slug: CharacterSlug;
  name: string;
  profile: string;
  role_in_story: string;
  voice_perspective: string;
  content_posture: string;
  what_to_show: string;
  what_to_protect: string;
  active_story_threads: string;
  consent_status: string | null;
  consent_notes: string | null;
  updated_at: string;
}

export type CharacterEditableKey = Exclude<
  keyof StoryCharacter,
  'id' | 'slug' | 'name' | 'updated_at'
>;

// ─── Story Drafts ─────────────────────────────────────────────────────────────

export type DraftStatus = 'draft' | 'reviewed' | 'approved' | 'archived';

export interface StoryDraft {
  id: string;
  opportunity_id: string;
  format: string;
  platform: string;
  hook: string;
  body: string;
  close: string;
  hashtags: string[];
  prompt_context: string;
  is_ai_generated: boolean;
  generation_model: string | null;
  generation_tokens: number | null;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

export const DRAFT_STATUS_STYLES: Record<DraftStatus, { bg: string; fg: string; label: string }> = {
  draft:    { bg: '#F1F5F9', fg: '#475569', label: 'Draft' },
  reviewed: { bg: '#FFFBEB', fg: '#B45309', label: 'Reviewed' },
  approved: { bg: '#ECFDF5', fg: '#047857', label: 'Approved' },
  archived: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const DRAFT_STATUSES: DraftStatus[] = ['draft', 'reviewed', 'approved', 'archived'];

// ─── Characters ───────────────────────────────────────────────────────────────

export const CHARACTER_PROFILE_FIELDS: {
  key: CharacterEditableKey;
  label: string;
  description: string;
  placeholder: string;
  rows: number;
  consentOnly?: boolean;
}[] = [
  {
    key: 'profile',
    label: 'Profile',
    description: 'Who this character is.',
    placeholder: 'Background, role, relationship to the business…',
    rows: 4,
  },
  {
    key: 'role_in_story',
    label: 'Role in the Story',
    description: 'The narrative function this character serves.',
    placeholder: 'Protagonist, supporter, brand entity…',
    rows: 3,
  },
  {
    key: 'voice_perspective',
    label: 'Voice / Perspective',
    description: 'How this character speaks. What they notice and care about.',
    placeholder: 'Direct, observational, warm, ambitious…',
    rows: 3,
  },
  {
    key: 'content_posture',
    label: 'Content Posture',
    description: 'How this character shows up in content. Energy, stance.',
    placeholder: 'Visible, behind the scenes, brand voice…',
    rows: 3,
  },
  {
    key: 'what_to_show',
    label: 'What to Show',
    description: 'Specifics of what to make visible for this character.',
    placeholder: 'Work, progress, personality, interactions…',
    rows: 4,
  },
  {
    key: 'what_to_protect',
    label: 'What to Protect',
    description: 'Things that are private, sensitive, or off-limits for content.',
    placeholder: 'Family details, personal struggles, private information…',
    rows: 4,
  },
  {
    key: 'active_story_threads',
    label: 'Active Story Threads',
    description: 'Current narrative threads this character is part of. Placeholder — Story Arcs will wire these in.',
    placeholder: 'e.g. Building the business from scratch, Silvan learning the trade…',
    rows: 3,
  },
  {
    key: 'consent_status',
    label: 'Consent Status',
    description: 'Explicit consent status for content featuring this character.',
    placeholder: 'e.g. Verbal consent given — general visibility only. No personal details.',
    rows: 2,
    consentOnly: true,
  },
  {
    key: 'consent_notes',
    label: 'Consent Notes',
    description: 'Any conditions, limits, or clarifications on consent.',
    placeholder: 'e.g. Agreed to appear in team content. Not comfortable with personal story arcs being public.',
    rows: 3,
    consentOnly: true,
  },
];
