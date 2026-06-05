export type PublishingPlatform = 'tiktok' | 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'website';
export type PublishingQueueStatus = 'draft' | 'ready' | 'published' | 'archived';

export interface MarketingPublishingQueueItem {
  id: string;
  title: string;
  production_card_id: string;
  platform: PublishingPlatform;
  format: string;
  related_arc_id: string | null;
  related_characters: string[];
  target_publish_at: string | null;
  status: PublishingQueueStatus;
  caption_placeholder: string;
  consent_verified: boolean;
  notes: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PUBLISHING_PLATFORMS: Array<{ key: PublishingPlatform; label: string }> = [
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'website', label: 'Website' },
];

export const PUBLISHING_QUEUE_STATUS_STYLES: Record<PublishingQueueStatus, { bg: string; fg: string; label: string }> = {
  draft:     { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Draft' },
  ready:     { bg: '#ECFDF5', fg: '#047857', label: 'Ready' },
  published: { bg: '#F1F5F9', fg: '#475569', label: 'Published' },
  archived:  { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const PUBLISHING_QUEUE_STATUSES: PublishingQueueStatus[] = ['draft', 'ready', 'published', 'archived'];
