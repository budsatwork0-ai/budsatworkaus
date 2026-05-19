import type { BudState } from './schemas';

export type { BudState };

export type AutonomyLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  0: 'Read-only',
  1: 'Suggest',
  2: 'Plan & Issue',
  3: 'Branch & PR',
  4: 'Preview Deploy',
  5: 'Auto-merge',
};

export type BudTask = {
  id: string;
  source_agent: string | null;
  target_agent: string | null;
  status: 'pending' | 'in_progress' | 'awaiting_approval' | 'completed' | 'failed' | 'archived';
  confidence: number | null;
  risk_level: 'low' | 'medium' | 'high' | 'critical' | null;
  description: string;
  autonomy_level: AutonomyLevel;
  linked_issue: string | null;
  linked_pr: string | null;
  linked_deployment: string | null;
  linked_memory_note: string | null;
  raw_input: Record<string, unknown> | null;
  raw_output: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type BudActivityEvent = {
  id: string;
  event_type: BudActivityEventType;
  narrative: string;
  actor: string | null;
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BudActivityEventType =
  | 'investigation'
  | 'repair'
  | 'deployment'
  | 'learning'
  | 'approval'
  | 'delegation'
  | 'detection'
  | 'completion'
  | 'error';

export type BudApprovalItem = {
  id: string;
  task_id: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type BudChangeRequest = {
  id: string;
  task_id: string | null;
  branch_name: string | null;
  issue_url: string | null;
  pr_url: string | null;
  deployment_url: string | null;
  status: 'open' | 'merged' | 'closed' | 'deployed';
  created_at: string;
};

export type BudLobbyState = {
  id: string;
  generated_at: string;
  operational_status: 'nominal' | 'elevated' | 'critical';
  bud_state: BudState;
  summary: string | null;
  sections: unknown[];
  workflows: unknown[];
  kpis: Record<string, unknown>;
  agent_states: Record<string, unknown>;
  is_current: boolean;
};

export type BudInsight = {
  id: string;
  agent_id: string | null;
  workflow_id: string | null;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
};

export const BUD_CLUSTERS: Record<string, string[]> = {
  Ops: ['admin-ux-designer', 'lobby-theme-curator', 'agent-architect', 'scheduling', 'crew-briefing', 'photo-qa'],
  Growth: ['competitor-scout', 'competitor-watcher', 'seo-meta', 'copy-optimizer', 'content-agent', 'lapsed-win-back', 'reviews'],
  Intelligence: ['heatmap-analyst', 'layout-critic', 'ab-test-architect', 'ux-intelligence', 'analytics-intelligence'],
  Finance: ['cash-flow-forecaster', 'reconciliation', 'stripe-dispute-manager', 'price-optimizer'],
  Infrastructure: ['github-historian', 'internal-qa', 'whs-safety-reminder', 'ndis-compliance', 'ndis-plan-matcher'],
  Customer: ['quote-triage', 'customer-reply', 'lead-scorer', 'phone-transcriber', 'applicant-screener', 'crew-coach', 'yard-map-geo'],
};
