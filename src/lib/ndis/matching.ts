// Rule-based NDIS participant matching algorithm
// Scores a participant's support profile against a job's requirements.

import type {
  ParticipantSupportProfile,
  JobRequirements,
  MatchReason,
  MatchFlag,
  PhysicalCapacity,
  PhysicalIntensity,
} from '@/types/ndis';

export interface MatchResult {
  score: number;
  max_score: number;
  reasons: MatchReason[];
  flags: MatchFlag[];
}

// Points per criterion
const POINTS = {
  timeWindow:       20,
  duration:         20,
  supportMode:      15,
  transport:        15,
  physicalCapacity: 10,
  servicePreference: 10,
  customerFacing:    5,
  travelRadius:      5,
};

const CAPACITY_RANK: Record<PhysicalCapacity, number> = { low: 0, medium: 1, high: 2 };
const INTENSITY_RANK: Record<PhysicalIntensity, number> = { low: 0, medium: 1, high: 2 };

function parseTime(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

export function scoreMatch(
  profile: ParticipantSupportProfile,
  requirements: JobRequirements,
): MatchResult {
  const reasons: MatchReason[] = [];
  const flags: MatchFlag[] = [];
  let score = 0;
  const max_score = Object.values(POINTS).reduce((a, b) => a + b, 0);

  // ── 1. Time window ──────────────────────────────────────────────────────────
  {
    const windowStart = parseTime(profile.support_window_start);
    const windowEnd   = parseTime(profile.support_window_end);
    const jobStart    = parseTime(requirements.start_time);
    const jobEnd      = parseTime(requirements.end_time);

    let passed = false;
    let note: string | undefined;

    if (windowStart !== null && windowEnd !== null && jobStart !== null && jobEnd !== null) {
      passed = jobStart >= windowStart && jobEnd <= windowEnd;
      if (!passed) {
        note = `Job ${requirements.start_time}–${requirements.end_time} is outside support window ${profile.support_window_start}–${profile.support_window_end}`;
        flags.push({
          type: 'support_hours_exceeded',
          label: 'Outside support window',
          severity: 'warning',
          detail: note,
        });
        if (!profile.can_work_after_support_hours) {
          flags.push({
            type: 'after_hours_blocked',
            label: 'Cannot work after funded support hours',
            severity: 'blocker',
            detail: 'Participant profile states they cannot work outside funded support hours.',
          });
        }
      }
    } else {
      passed = true;
      note = 'No time window set — assumed compatible';
    }

    if (passed) score += POINTS.timeWindow;
    reasons.push({
      criterion: 'timeWindow',
      label: 'Fits support window',
      passed,
      points: passed ? POINTS.timeWindow : 0,
      max_points: POINTS.timeWindow,
      note,
    });
  }

  // ── 2. Duration ─────────────────────────────────────────────────────────────
  {
    const maxMins = profile.max_shift_duration_minutes;
    const jobMins = requirements.estimated_duration_minutes;
    let passed = false;
    let note: string | undefined;

    if (jobMins !== null) {
      passed = jobMins <= maxMins;
      if (!passed) {
        const over = jobMins - maxMins;
        note = `Job is ${jobMins} min; participant max is ${maxMins} min (${over} min over)`;
        if (requirements.can_split_shift) {
          flags.push({
            type: 'support_hours_exceeded',
            label: 'Shift can be split',
            severity: 'warning',
            detail: note + '. Job supports splitting into segments.',
          });
        } else {
          flags.push({
            type: 'support_hours_exceeded',
            label: 'Shift exceeds max duration',
            severity: 'warning',
            detail: note,
          });
        }
      }
    } else {
      passed = true;
      note = 'Duration not specified — assumed compatible';
    }

    if (passed) score += POINTS.duration;
    reasons.push({
      criterion: 'duration',
      label: 'Duration within shift limit',
      passed,
      points: passed ? POINTS.duration : 0,
      max_points: POINTS.duration,
      note,
    });
  }

  // ── 3. Support mode ─────────────────────────────────────────────────────────
  {
    const reqMode = requirements.required_support_mode;
    const profMode = profile.support_mode;
    const passed = reqMode === 'any' || reqMode === profMode;
    const note = passed
      ? undefined
      : `Job requires ${reqMode}; participant is ${profMode}`;

    if (passed) score += POINTS.supportMode;
    reasons.push({
      criterion: 'supportMode',
      label: 'Support mode compatible',
      passed,
      points: passed ? POINTS.supportMode : 0,
      max_points: POINTS.supportMode,
      note,
    });

    if (!passed && profMode === 'supported' && profile.support_worker_name === null) {
      flags.push({
        type: 'support_worker_unassigned',
        label: 'No support worker assigned',
        severity: 'warning',
        detail: 'Participant needs a support worker but none is assigned in their profile.',
      });
    }
  }

  // ── 4. Transport ────────────────────────────────────────────────────────────
  {
    const needsTransport = requirements.transport_required;
    const hasTransport = profile.transport_status !== 'needs_transport';
    const passed = !needsTransport || hasTransport;
    let note: string | undefined;

    if (!passed) {
      note = 'Job requires transport but participant has no transport arranged';
      flags.push({
        type: 'transport_missing',
        label: 'Transport not available',
        severity: 'warning',
        detail: note,
      });
    }

    if (passed) score += POINTS.transport;
    reasons.push({
      criterion: 'transport',
      label: 'Transport available',
      passed,
      points: passed ? POINTS.transport : 0,
      max_points: POINTS.transport,
      note,
    });
  }

  // ── 5. Physical capacity ────────────────────────────────────────────────────
  {
    const capRank = CAPACITY_RANK[profile.physical_capacity];
    const intRank = INTENSITY_RANK[requirements.physical_intensity];
    const passed = capRank >= intRank;
    const note = passed
      ? undefined
      : `Job intensity is ${requirements.physical_intensity}; participant capacity is ${profile.physical_capacity}`;

    if (!passed) {
      flags.push({
        type: 'capacity_mismatch',
        label: 'Physical intensity too high',
        severity: 'warning',
        detail: note,
      });
    }

    if (passed) score += POINTS.physicalCapacity;
    reasons.push({
      criterion: 'physicalCapacity',
      label: 'Physical capacity suitable',
      passed,
      points: passed ? POINTS.physicalCapacity : 0,
      max_points: POINTS.physicalCapacity,
      note,
    });
  }

  // ── 6. Service preference ───────────────────────────────────────────────────
  {
    const preferred = profile.preferred_services ?? [];
    const jobType = requirements.service_type ?? '';
    const passed = preferred.length === 0 || preferred.includes(jobType);
    const note = passed
      ? preferred.length === 0 ? 'No service preference set' : undefined
      : `${jobType} is not in participant's preferred services`;

    if (passed) score += POINTS.servicePreference;
    reasons.push({
      criterion: 'servicePreference',
      label: 'Service type preferred',
      passed,
      points: passed ? POINTS.servicePreference : 0,
      max_points: POINTS.servicePreference,
      note,
    });
  }

  // ── 7. Customer facing ──────────────────────────────────────────────────────
  {
    const required = requirements.customer_facing_required;
    const ok = profile.customer_facing_ok;
    const passed = !required || ok;
    const note = passed ? undefined : 'Job requires customer contact; participant is not approved for customer-facing roles';

    if (passed) score += POINTS.customerFacing;
    reasons.push({
      criterion: 'customerFacing',
      label: 'Customer-facing suitable',
      passed,
      points: passed ? POINTS.customerFacing : 0,
      max_points: POINTS.customerFacing,
      note,
    });
  }

  // ── 8. Travel radius ─────────────────────────────────────────────────────────
  // Exact distance scoring is deferred (no geocoding in MVP).
  // If both have coordinates, we estimate; otherwise pass by default.
  {
    const profileLat = null; // participant location not stored yet
    const jobLat = requirements.location_lat;
    const jobLng = requirements.location_lng;

    let passed = true;
    let note: string | undefined;

    if (profileLat === null || jobLat === null || jobLng === null) {
      note = 'Location not available — assumed within range';
    }

    if (passed) score += POINTS.travelRadius;
    reasons.push({
      criterion: 'travelRadius',
      label: 'Within travel radius',
      passed,
      points: passed ? POINTS.travelRadius : 0,
      max_points: POINTS.travelRadius,
      note,
    });
  }

  return { score, max_score, reasons, flags };
}

export function hasBlockers(flags: MatchFlag[]): boolean {
  return flags.some((f) => f.severity === 'blocker');
}

export function matchGrade(score: number, max: number): 'strong' | 'good' | 'partial' | 'poor' {
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.85) return 'strong';
  if (pct >= 0.65) return 'good';
  if (pct >= 0.40) return 'partial';
  return 'poor';
}

export const MATCH_GRADE_LABELS = {
  strong: 'Strong match',
  good: 'Good match',
  partial: 'Partial match',
  poor: 'Poor match',
};

export const MATCH_GRADE_COLORS = {
  strong: { bg: 'rgba(16,185,129,0.12)', text: '#065F46' },
  good:   { bg: 'rgba(59,130,246,0.12)', text: '#1E40AF' },
  partial: { bg: 'rgba(245,158,11,0.12)', text: '#92400E' },
  poor:   { bg: 'rgba(239,68,68,0.12)', text: '#991B1B' },
};
