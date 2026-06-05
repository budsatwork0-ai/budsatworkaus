export type ContentScriptStatus = 'draft' | 'approved' | 'archived';

export interface ContentScript {
  id: string;
  idea_id: string;
  hook: string;
  setup: string;
  core_moment: string;
  close_cta: string;
  platform: string;
  format: string;
  status: ContentScriptStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const CONTENT_SCRIPT_STATUS_STYLES: Record<ContentScriptStatus, { bg: string; fg: string; label: string }> = {
  draft:    { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Draft' },
  approved: { bg: '#ECFDF5', fg: '#047857', label: 'Approved' },
  archived: { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const CONTENT_SCRIPT_STATUSES: ContentScriptStatus[] = ['draft', 'approved', 'archived'];
