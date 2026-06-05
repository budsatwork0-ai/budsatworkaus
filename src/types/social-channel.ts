export type SocialChannelStatus = 'active' | 'paused' | 'planned' | 'archived';

export type SocialChannelPlatform = typeof SOCIAL_CHANNEL_PLATFORMS[number];

export interface SocialChannel {
  id: string;
  platform: SocialChannelPlatform;
  handle: string;
  profile_url: string;
  primary_format: string;
  posting_target_per_week: number;
  primary_audience: string;
  content_notes: string;
  status: SocialChannelStatus;
  connected: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const SOCIAL_CHANNEL_STATUSES: SocialChannelStatus[] = ['active', 'paused', 'planned', 'archived'];

export const SOCIAL_CHANNEL_STATUS_STYLES: Record<SocialChannelStatus, { bg: string; fg: string; label: string }> = {
  active:   { bg: '#ECFDF5', fg: '#047857', label: 'Active' },
  paused:   { bg: '#FFFBEB', fg: '#B45309', label: 'Paused' },
  planned:  { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Planned' },
  archived: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const SOCIAL_CHANNEL_PLATFORMS = [
  'tiktok',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'website',
] as const;

export const SOCIAL_CHANNEL_PLATFORM_LABELS: Record<SocialChannelPlatform, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  facebook:  'Facebook',
  youtube:   'YouTube',
  linkedin:  'LinkedIn',
  website:   'Website',
};
