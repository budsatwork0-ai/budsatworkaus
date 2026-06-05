export type DistributionPlaybookStatus = 'active' | 'draft' | 'archived';

export interface DistributionPlaybook {
  id: string;
  title: string;
  description: string;
  content_type: string;
  primary_platform: string;
  secondary_platforms: string[];
  steps: string[];
  checklist: string[];
  linked_campaign_id: string | null;
  status: DistributionPlaybookStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const DISTRIBUTION_PLAYBOOK_STATUSES: DistributionPlaybookStatus[] = ['active', 'draft', 'archived'];

export const DISTRIBUTION_PLAYBOOK_STATUS_STYLES: Record<DistributionPlaybookStatus, { bg: string; fg: string; label: string }> = {
  active:   { bg: '#ECFDF5', fg: '#047857', label: 'Active' },
  draft:    { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Draft' },
  archived: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const DISTRIBUTION_PLAYBOOK_PLATFORMS = [
  'tiktok',
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'website',
] as const;
