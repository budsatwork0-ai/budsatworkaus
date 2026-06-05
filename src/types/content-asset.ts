export type ContentAssetType = 'footage' | 'photo' | 'graphic' | 'testimonial' | 'other';
export type ContentAssetConsentStatus = 'unknown' | 'not_required' | 'pending' | 'confirmed' | 'denied';

export interface ContentAsset {
  id: string;
  title: string;
  asset_type: ContentAssetType;
  source_url: string;
  production_card_id: string | null;
  idea_id: string | null;
  script_id: string | null;
  consent_status: ContentAssetConsentStatus;
  related_characters: string[];
  related_customer: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const CONTENT_ASSET_TYPES: Array<{ key: ContentAssetType; label: string }> = [
  { key: 'footage', label: 'Footage' },
  { key: 'photo', label: 'Photo' },
  { key: 'graphic', label: 'Graphic' },
  { key: 'testimonial', label: 'Testimonial' },
  { key: 'other', label: 'Other' },
];

export const CONTENT_ASSET_CONSENT_STYLES: Record<ContentAssetConsentStatus, { bg: string; fg: string; label: string; risky: boolean }> = {
  unknown:      { bg: '#FEF2F2', fg: '#B91C1C', label: 'Unknown', risky: true },
  not_required: { bg: '#F1F5F9', fg: '#475569', label: 'Not required', risky: false },
  pending:      { bg: '#FFFBEB', fg: '#B45309', label: 'Pending', risky: true },
  confirmed:    { bg: '#ECFDF5', fg: '#047857', label: 'Confirmed', risky: false },
  denied:       { bg: '#FEF2F2', fg: '#B91C1C', label: 'Denied', risky: true },
};

export const CONTENT_ASSET_CONSENT_STATUSES: ContentAssetConsentStatus[] = [
  'unknown',
  'not_required',
  'pending',
  'confirmed',
  'denied',
];
