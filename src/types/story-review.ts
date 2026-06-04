// ─── Story Review types (Phase 2G) ────────────────────────────────────────────

export type StoryReviewStatus =
  | 'pending_review'
  | 'changes_required'
  | 'approved'
  | 'rejected';

export interface StoryReview {
  id: string;
  draft_id: string;
  review_status: StoryReviewStatus;
  safety_score: number;
  consent_verified: boolean;
  privacy_checked: boolean;
  factual_accuracy_checked: boolean;
  brand_alignment_checked: boolean;
  findings: ReviewFinding[];
  reviewer_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Review findings ──────────────────────────────────────────────────────────

export type ReviewFindingCategory = 'privacy' | 'brand' | 'factual' | 'consent';

export type ReviewFindingSeverity = 'blocker' | 'warning' | 'info';

export interface ReviewFinding {
  category: ReviewFindingCategory;
  severity: ReviewFindingSeverity;
  message: string;
}

// ─── Review result (output of evaluateDraft) ─────────────────────────────────

export type ReviewRecommendation = 'approve' | 'changes_required' | 'reject';

export interface ReviewResult {
  findings: ReviewFinding[];
  safety_score: number;
  recommendation: ReviewRecommendation;
  privacy_checked: boolean;
  consent_verified: boolean;
  factual_accuracy_checked: boolean;
  brand_alignment_checked: boolean;
}
