import { type ArtifactContent } from './artifact';

export type OutcomeScoreResult = 'missed' | 'partial' | 'met' | 'exceeded';

export type ContentOutcomeScore = {
  score: number;
  goal: string;
  primaryMetric: string;
  primaryValue: number;
  targetValue?: number;
  result: OutcomeScoreResult;
  reason: string;
};

export type ContentLearningEvidence = {
  sourceTable: string;
  sourceId: string | null;
  label: string;
  detail: string;
  metric?: string;
  value?: number;
};

export type ContentLearningPoint = {
  title: string;
  detail: string;
  evidence: string;
  signalType: string;
};

export type ContentFutureAction = {
  action: string;
  rationale: string;
  appliesToGoals: string[];
  priority: 'high' | 'medium' | 'low';
};

export type ContentLearningRecord = {
  id: string;
  campaign_factory_run_id: string | null;
  campaign_id: string | null;
  learning_artifact_id: string | null;
  goal: string;
  campaign_title: string;
  source_artifact_ids: string[];
  source_library_item_ids: string[];
  outcome_score: ContentOutcomeScore;
  results: Record<string, unknown>;
  what_worked: ContentLearningPoint[];
  what_failed: ContentLearningPoint[];
  supporting_evidence: ContentLearningEvidence[];
  recommended_future_actions: ContentFutureAction[];
  confidence: number;
  confidence_reason: string;
  status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningArtifactResult = {
  title: string;
  summary: string;
  content: ArtifactContent;
  plainText: string;
};

export type LearningGuidance = {
  use: ContentFutureAction[];
  avoid: ContentLearningPoint[];
  evidence: ContentLearningEvidence[];
  learningArtifactIds: string[];
};
