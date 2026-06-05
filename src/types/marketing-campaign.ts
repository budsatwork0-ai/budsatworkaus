import { type MarketingPublishingQueueItem } from './publishing-queue';

export type MarketingCampaignStatus = 'planning' | 'active' | 'completed' | 'archived';

export type MarketingCampaignKpis = Record<string, string | number | boolean | null>;

export interface MarketingCampaign {
  id: string;
  name: string;
  goal: string;
  related_arc_id: string | null;
  target_audience: string;
  channels: string[];
  linked_publishing_queue_items: string[];
  start_date: string | null;
  end_date: string | null;
  status: MarketingCampaignStatus;
  kpis: MarketingCampaignKpis;
  result_summary: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MarketingCampaignWithQueueItems extends MarketingCampaign {
  queue_items: MarketingPublishingQueueItem[];
}

export const MARKETING_CAMPAIGN_STATUSES: MarketingCampaignStatus[] = ['planning', 'active', 'completed', 'archived'];

export const MARKETING_CAMPAIGN_STATUS_STYLES: Record<MarketingCampaignStatus, { bg: string; fg: string; label: string }> = {
  planning:  { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Planning' },
  active:    { bg: '#ECFDF5', fg: '#047857', label: 'Active' },
  completed: { bg: '#F1F5F9', fg: '#475569', label: 'Completed' },
  archived:  { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const MARKETING_CAMPAIGN_CHANNELS = [
  'tiktok',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'website',
] as const;
