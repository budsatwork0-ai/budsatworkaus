export type ContentProductionStatus = 'to_film' | 'in_edit' | 'ready_to_publish' | 'published';

export interface ContentProductionCard {
  id: string;
  script_id: string;
  title: string;
  platform: string;
  format: string;
  related_arc_id: string | null;
  related_characters: string[];
  deadline: string | null;
  status: ContentProductionStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const CONTENT_PRODUCTION_STATUS_STYLES: Record<ContentProductionStatus, { bg: string; fg: string; label: string }> = {
  to_film:          { bg: '#EFF6FF', fg: '#1D4ED8', label: 'To Film' },
  in_edit:          { bg: '#FFFBEB', fg: '#B45309', label: 'In Edit' },
  ready_to_publish: { bg: '#ECFDF5', fg: '#047857', label: 'Ready to Publish' },
  published:        { bg: '#F1F5F9', fg: '#475569', label: 'Published' },
};

export const CONTENT_PRODUCTION_STATUSES: ContentProductionStatus[] = [
  'to_film',
  'in_edit',
  'ready_to_publish',
  'published',
];
