// Shared types for the Autonomous Improvement Pipeline.
// Mirrors the Supabase enums in supabase/migrations/065_autonomy_pipeline.sql.

export type PipelineSurface = 'public' | 'admin' | 'crew' | 'customer';

export type PipelineStageId =
  | 'detect'
  | 'analyze'
  | 'design'
  | 'generate'
  | 'sandbox'
  | 'validate'
  | 'reject'
  | 'debate'
  | 'deploy'
  | 'observe';

export type PipelineStageStatus =
  | 'idle'
  | 'active'
  | 'passed'
  | 'rejected'
  | 'skipped';

export type PipelineRunStatus =
  | 'open'
  | 'in_progress'
  | 'succeeded'
  | 'rejected'
  | 'rolled_back';

export type PipelineRunVerdict =
  | 'pending'
  | 'auto_merge'
  | 'human_review'
  | 'rejected'
  | 'rolled_back';

export interface PipelineRun {
  id: string;
  surface: PipelineSurface;
  trigger_signal: string;
  trigger_payload: Record<string, unknown> | null;
  status: PipelineRunStatus;
  verdict: PipelineRunVerdict;
  composite_score: number | null;
  pr_url: string | null;
  preview_url: string | null;
  rolled_back_at: string | null;
  rollback_reason: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface PipelineStageEvent {
  id: number;
  run_id: string;
  stage: PipelineStageId;
  status: PipelineStageStatus;
  payload: Record<string, unknown> | null;
  ts: string;
}

export interface PipelineArtifact {
  id: number;
  run_id: string;
  stage: PipelineStageId | null;
  kind:
    | 'diff'
    | 'preview_url'
    | 'visual_diff'
    | 'axe'
    | 'lighthouse'
    | 'rationale'
    | 'telemetry'
    | string;
  label: string | null;
  url: string | null;
  body: Record<string, unknown> | null;
  created_at: string;
}

export interface PipelineAgentScore {
  id: number;
  run_id: string;
  agent: string;
  dimension: 'confidence' | 'trust' | 'rollback' | 'UX' | 'stability' | string;
  value: number;
  rationale: string | null;
  is_skeptic: boolean;
  created_at: string;
}

export interface PipelineKpis {
  surface: PipelineSurface;
  auto_merged: number;
  auto_rejected: number;
  rollbacks: number;
  median_seconds: number;
}

export interface PipelineRunDetail {
  run: PipelineRun;
  stages: Record<PipelineStageId, PipelineStageStatus>;
  events: PipelineStageEvent[];
  artifacts: PipelineArtifact[];
  scores: PipelineAgentScore[];
}
