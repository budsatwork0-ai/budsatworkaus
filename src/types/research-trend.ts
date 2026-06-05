export type ResearchTrendPlatform = typeof RESEARCH_TREND_PLATFORMS[number];
export type ResearchTrendType    = typeof RESEARCH_TREND_TYPES[number];
export type ResearchTrendUrgency = typeof RESEARCH_TREND_URGENCIES[number];
export type ResearchTrendStatus  = typeof RESEARCH_TREND_STATUSES[number];

export interface ResearchTrend {
  id:               string;
  platform:         ResearchTrendPlatform;
  title:            string;
  description:      string;
  trend_type:       ResearchTrendType;
  urgency:          ResearchTrendUrgency;
  adaptation_angle: string;
  story_arc_id:     string | null;
  status:           ResearchTrendStatus;
  notes:            string;
  created_at:       string;
  updated_at:       string;
}

export const RESEARCH_TREND_PLATFORMS = [
  'tiktok',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'website',
] as const;

export const RESEARCH_TREND_TYPES = [
  'audio',
  'format',
  'hook',
  'topic',
  'visual_style',
  'other',
] as const;

export const RESEARCH_TREND_URGENCIES = [
  'evergreen',
  'two_week_window',
  'forty_eight_hour_window',
] as const;

export const RESEARCH_TREND_STATUSES = [
  'watching',
  'adapting',
  'published',
  'expired',
] as const;

export const PLATFORM_LABELS: Record<ResearchTrendPlatform, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  facebook:  'Facebook',
  youtube:   'YouTube',
  linkedin:  'LinkedIn',
  website:   'Website',
};

export const TREND_TYPE_LABELS: Record<ResearchTrendType, string> = {
  audio:        'Audio',
  format:       'Format',
  hook:         'Hook',
  topic:        'Topic',
  visual_style: 'Visual Style',
  other:        'Other',
};

export const URGENCY_LABELS: Record<ResearchTrendUrgency, string> = {
  evergreen:               'Evergreen',
  two_week_window:         '2-Week Window',
  forty_eight_hour_window: '48-Hour Window',
};

export const URGENCY_STYLES: Record<ResearchTrendUrgency, { bg: string; fg: string }> = {
  evergreen:               { bg: '#ECFDF5', fg: '#047857' },
  two_week_window:         { bg: '#FFFBEB', fg: '#B45309' },
  forty_eight_hour_window: { bg: '#FEF2F2', fg: '#B91C1C' },
};

export const STATUS_LABELS: Record<ResearchTrendStatus, string> = {
  watching:  'Watching',
  adapting:  'Adapting',
  published: 'Published',
  expired:   'Expired',
};

export const STATUS_STYLES: Record<ResearchTrendStatus, { bg: string; fg: string }> = {
  watching:  { bg: '#EFF6FF', fg: '#1D4ED8' },
  adapting:  { bg: '#FFFBEB', fg: '#B45309' },
  published: { bg: '#ECFDF5', fg: '#047857' },
  expired:   { bg: '#F8FAFC', fg: '#64748B' },
};
