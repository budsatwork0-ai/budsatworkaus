export type ContentIdeaStatus = 'captured' | 'developed' | 'scripted' | 'archived';

export interface ContentIdea {
  id: string;
  title: string;
  opportunity_id: string | null;
  related_arc_id: string | null;
  related_characters: string[];
  platform_fit: string;
  format: string;
  hook: string;
  content_angle: string;
  status: ContentIdeaStatus;
  priority: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const CONTENT_IDEA_STATUS_STYLES: Record<ContentIdeaStatus, { bg: string; fg: string; label: string }> = {
  captured:  { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Captured' },
  developed: { bg: '#ECFDF5', fg: '#047857', label: 'Developed' },
  scripted:  { bg: '#FFFBEB', fg: '#B45309', label: 'Scripted' },
  archived:  { bg: '#FEF2F2', fg: '#B91C1C', label: 'Archived' },
};

export const CONTENT_IDEA_STATUSES: ContentIdeaStatus[] = ['captured', 'developed', 'scripted', 'archived'];
