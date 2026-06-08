/**
 * TypeScript types for the Executive Agent Layer (migration 110_executive_agents).
 */

// ── executive_decisions ───────────────────────────────────────────────────────

export type DecisionRiskLevel = 'low' | 'medium' | 'high';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'deferred';

export interface ExecutiveDecision {
  id: string;
  agent_id: string;
  run_id: string | null;
  title: string;
  reasoning: string;
  evidence: string[];
  confidence: number;          // 0–1
  risk_level: DecisionRiskLevel;
  expected_impact: string;
  status: DecisionStatus;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InsertExecutiveDecision = Omit<ExecutiveDecision, 'id' | 'created_at' | 'updated_at' | 'executed_at' | 'status'> & {
  status?: DecisionStatus;
};

// ── executive_tasks ───────────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';
export type TaskStatus   = 'open' | 'in_progress' | 'completed' | 'cancelled';

export interface ExecutiveTask {
  id: string;
  decision_id: string | null;
  source_agent_id: string;
  target_agent_id: string | null;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InsertExecutiveTask = Omit<ExecutiveTask, 'id' | 'created_at' | 'updated_at' | 'completed_at' | 'status' | 'priority' | 'due_at'> & {
  priority?: TaskPriority;
  status?: TaskStatus;
  due_at?: string | null;
};

// ── executive_metrics_snapshots ───────────────────────────────────────────────

export interface ExecutiveMetricsSnapshot {
  id: string;
  captured_at: string;
  revenue_7d_aud: number | null;
  jobs_7d: number | null;
  leads_7d: number | null;
  conversion_rate: number | null;   // 0–1
  avg_job_value: number | null;
  cash_position: number | null;
  crew_utilisation: number | null;  // 0–1
  raw: Record<string, unknown>;
}

// ── executive_weekly_reviews ──────────────────────────────────────────────────

export interface WeeklyReviewWin {
  title: string;
  detail: string;
}

export interface WeeklyReviewRisk {
  title: string;
  detail: string;
  severity: 'low' | 'medium' | 'high';
}

export interface WeeklyReviewPriority {
  title: string;
  owner: string;
  due: string;
}

export interface AgentLearning {
  agent_id: string;
  insight: string;
}

export interface ExecutiveWeeklyReview {
  id: string;
  week_start: string;    // ISO date 'YYYY-MM-DD'
  summary: string;
  wins: WeeklyReviewWin[];
  risks: WeeklyReviewRisk[];
  priorities: WeeklyReviewPriority[];
  agent_learnings: AgentLearning[];
  created_at: string;
}

// ── executive_kpi_targets ─────────────────────────────────────────────────────

export type KpiUnit = 'aud' | 'percent' | 'count' | 'number';

export interface ExecutiveKpiTarget {
  id: string;
  kpi_key: string;
  label: string;
  target: number;
  unit: KpiUnit;
  owner: string;
  active: boolean;
  set_at: string;
  updated_at: string;
}

// ── executive_directives ──────────────────────────────────────────────────────

export type DirectiveStatus = 'active' | 'completed' | 'cancelled';

export interface ExecutiveDirective {
  id: string;
  title: string;
  description: string;
  issued_by: string;
  status: DirectiveStatus;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

// ── executive_agent_runs_meta ─────────────────────────────────────────────────

export interface ExecutiveAgentRunsMeta {
  id: string;
  run_id: string;
  agent_id: string;
  decisions: number;
  tasks: number;
  auto_executed: number;
  queued_approvals: number;
  created_at: string;
}

// ── Shared LLM output shape used by all 4 functional executives ──────────────

export interface ExecutiveLlmOutput {
  summary: string;
  decisions: Array<{
    title: string;
    reasoning: string;
    evidence: string[];
    confidence: number;
    risk_level: DecisionRiskLevel;
    expected_impact: string;
  }>;
}
