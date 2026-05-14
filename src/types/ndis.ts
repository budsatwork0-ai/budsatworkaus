// NDIS participant matching types for Buds At Work

export type SupportMode = 'independent' | 'supported' | 'team_based';
export type TransportStatus = 'independent' | 'needs_transport' | 'arranged';
export type PhysicalCapacity = 'low' | 'medium' | 'high';
export type PhysicalIntensity = 'low' | 'medium' | 'high';
export type RequiredSupportMode = SupportMode | 'any';
export type PublicationStatus = 'published' | 'accepted' | 'declined' | 'withdrawn';
export type SegmentStatus = 'unassigned' | 'published' | 'accepted' | 'completed';
export type TransportArrangementType = 'self' | 'support_worker' | 'company' | 'public';

export interface ParticipantSupportProfile {
  id: string;
  employee_id: string;
  support_window_start: string | null;   // 'HH:MM'
  support_window_end: string | null;     // 'HH:MM'
  max_shift_duration_minutes: number;
  support_mode: SupportMode;
  transport_status: TransportStatus;
  travel_radius_km: number;
  preferred_services: string[];
  physical_capacity: PhysicalCapacity;
  customer_facing_ok: boolean;
  can_work_after_support_hours: boolean;
  supervision_notes: string | null;
  risk_notes: string | null;
  emergency_contact: string | null;
  support_worker_name: string | null;
  support_worker_provider: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobRequirements {
  id: string;
  order_id: string;
  estimated_duration_minutes: number | null;
  required_support_mode: RequiredSupportMode;
  physical_intensity: PhysicalIntensity;
  transport_required: boolean;
  customer_facing_required: boolean;
  service_type: string | null;
  location_suburb: string | null;
  location_lat: number | null;
  location_lng: number | null;
  start_time: string | null;   // 'HH:MM'
  end_time: string | null;     // 'HH:MM'
  can_split_shift: boolean;
  requires_team: boolean;
  risk_notes: string | null;
  ndis_matching_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MatchReason {
  criterion: string;
  label: string;
  passed: boolean;
  points: number;
  max_points: number;
  note?: string;
}

export interface MatchFlag {
  type: 'support_hours_exceeded' | 'transport_missing' | 'support_worker_unassigned' | 'after_hours_blocked' | 'capacity_mismatch';
  label: string;
  severity: 'warning' | 'blocker';
  detail?: string;
}

export interface JobParticipantMatch {
  id: string;
  order_id: string;
  employee_id: string;
  score: number;
  max_score: number;
  reasons: MatchReason[];
  flags: MatchFlag[];
  computed_at: string;
  // Joined from employees
  employee?: {
    id: string;
    full_name: string;
    email: string;
    suburb: string | null;
    services: string[] | null;
    ndis_worker: boolean;
    support_profile?: ParticipantSupportProfile | null;
  };
}

export interface JobPublication {
  id: string;
  order_id: string;
  employee_id: string;
  published_by: string | null;
  status: PublicationStatus;
  override_reason: string | null;
  published_at: string;
  responded_at: string | null;
  employee?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ShiftSegment {
  id: string;
  order_id: string;
  employee_id: string | null;
  segment_number: number;
  start_time: string | null;
  end_time: string | null;
  estimated_duration_minutes: number | null;
  status: SegmentStatus;
  notes: string | null;
  created_at: string;
}

export interface TransportArrangement {
  id: string;
  order_id: string;
  employee_id: string;
  arrangement_type: TransportArrangementType;
  notes: string | null;
  confirmed: boolean;
  created_at: string;
}

// Used in the crew Find Jobs page for publication-sourced jobs
export interface PublishedJobCard {
  publication_id: string;
  order_id: string;
  service_type: string;
  location_suburb: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  estimated_duration_minutes: number | null;
  support_mode: RequiredSupportMode;
  transport_required: boolean;
  customer_facing_required: boolean;
  published_at: string;
  match_score: number | null;
  match_max_score: number | null;
  flags: MatchFlag[];
  fits_support_window: boolean;
}

// Labels
export const SUPPORT_MODE_LABELS: Record<SupportMode, string> = {
  independent: 'Independent',
  supported: 'With Support Worker',
  team_based: 'Team Based',
};

export const TRANSPORT_STATUS_LABELS: Record<TransportStatus, string> = {
  independent: 'Own transport',
  needs_transport: 'Needs transport',
  arranged: 'Transport arranged',
};

export const PHYSICAL_CAPACITY_LABELS: Record<PhysicalCapacity, string> = {
  low: 'Light tasks only',
  medium: 'Moderate physical work',
  high: 'Heavy physical work',
};

export const PHYSICAL_INTENSITY_LABELS: Record<PhysicalIntensity, string> = {
  low: 'Light',
  medium: 'Moderate',
  high: 'Heavy',
};

export const REQUIRED_SUPPORT_MODE_LABELS: Record<RequiredSupportMode, string> = {
  independent: 'Independent worker',
  supported: 'Needs support worker on site',
  team_based: 'Team-based only',
  any: 'Any support mode',
};
