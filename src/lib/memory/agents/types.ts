/**
 * Types for the agent workspace system.
 *
 * Each workspace is a named Obsidian folder (e.g. Agents/UX-Agent/)
 * containing structured markdown documents written by agents at runtime.
 *
 * Seven workspaces map to the platform's agent domains:
 *   UX-Agent, Frontend-Agent, Performance-Agent, Admin-Agent,
 *   Analytics-Agent, Design-System-Agent, Meta-Agent
 */

// ── Workspace registry ────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  id: string;             // e.g. 'ux-agent'
  folder: string;         // vault subfolder name, e.g. 'UX-Agent'
  label: string;          // human label
  description: string;
  agentIds: string[];     // agent IDs whose runs log into this workspace
}

export const WORKSPACES: WorkspaceConfig[] = [
  {
    id: 'ux-agent',
    folder: 'UX-Agent',
    label: 'UX Agent',
    description: 'User experience, interface analysis, A/B testing, heatmap findings, layout critique.',
    agentIds: ['ux-intelligence', 'layout-critic', 'heatmap-analyst', 'admin-ux-designer', 'ab-test-architect'],
  },
  {
    id: 'frontend-agent',
    folder: 'Frontend-Agent',
    label: 'Frontend Agent',
    description: 'Copy optimisation, SEO metadata, content generation, conversion copy.',
    agentIds: ['copy-optimizer', 'seo-meta', 'content-agent'],
  },
  {
    id: 'performance-agent',
    folder: 'Performance-Agent',
    label: 'Performance Agent',
    description: 'Conversion funnel analysis, competitor intelligence, photo quality assurance.',
    agentIds: ['conversion-funnel', 'competitor-scout', 'photo-qa'],
  },
  {
    id: 'admin-agent',
    folder: 'Admin-Agent',
    label: 'Admin Agent',
    description: 'Operations, scheduling, crew management, finance reconciliation, compliance, NDIS.',
    agentIds: [
      'admin-optimization',
      'quote-triage', 'lead-scorer', 'lapsed-win-back', 'customer-reply',
      'scheduling', 'crew-briefing', 'crew-coach',
      'reconciliation', 'cash-flow-forecaster', 'stripe-dispute-manager',
      'whs-safety-reminder', 'ndis-compliance', 'ndis-plan-matcher',
      'applicant-screener', 'yard-map-geo',
    ],
  },
  {
    id: 'analytics-agent',
    folder: 'Analytics-Agent',
    label: 'Analytics Agent',
    description: 'Customer reviews, phone transcription, analytics insights, competitor tracking.',
    agentIds: ['reviews', 'phone-transcriber'],
  },
  {
    id: 'design-system-agent',
    folder: 'Design-System-Agent',
    label: 'Design System Agent',
    description: 'Design language, visual consistency audits, component standards, glass morphism, typography, Apple-inspired simplicity.',
    agentIds: ['lobby-theme-curator', 'design-system'],
  },
  {
    id: 'meta-agent',
    folder: 'Meta-Agent',
    label: 'Meta Agent',
    description: 'Platform orchestration, quality assurance, agent architecture, system oversight.',
    agentIds: ['foreman', 'agent-architect', 'internal-qa', 'github-historian'],
  },
];

/** Reverse map: agentId → workspaceId */
export const AGENT_WORKSPACE_MAP: Record<string, string> = Object.fromEntries(
  WORKSPACES.flatMap((w) => w.agentIds.map((a) => [a, w.id])),
);

/** Workspace subfolders — every workspace has these six directories. */
export const WORKSPACE_SUBFOLDERS = [
  'Findings',
  'Tasks',
  'Reports',
  'Decisions',
  'Active-Issues',
  'Resolved-Issues',
] as const;

export type WorkspaceSubfolder = (typeof WORKSPACE_SUBFOLDERS)[number];

// ── Document types ────────────────────────────────────────────────────────────

export type FindingSeverity = 'info' | 'warning' | 'critical';
export type TaskStatus      = 'open' | 'in-progress' | 'done' | 'blocked';
export type TaskPriority    = 'low' | 'medium' | 'high' | 'critical';
export type DecisionStatus  = 'proposed' | 'accepted' | 'rejected' | 'superseded';
export type DecisionImpact  = 'low' | 'medium' | 'high';
export type IssueSeverity   = 'low' | 'medium' | 'high' | 'critical';
export type ReportPeriod    = 'daily' | 'weekly' | 'monthly';

// ── Finding ───────────────────────────────────────────────────────────────────

export interface AgentFinding {
  title: string;
  summary: string;
  severity: FindingSeverity;
  systems?: string[];
  tags?: string[];
  runId?: string;
  /** Full body markdown (optional — generated from summary if omitted). */
  body?: string;
  /** Vault paths to link to. */
  relatedDecisions?: string[];
  relatedIssues?: string[];
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface AgentTask {
  title: string;
  context: string;
  acceptanceCriteria?: string[];
  priority: TaskPriority;
  status?: TaskStatus;
  systems?: string[];
  tags?: string[];
  runId?: string;
}

// ── Decision ──────────────────────────────────────────────────────────────────

export interface AgentDecision {
  title: string;
  context: string;
  rationale: string;
  consequences?: string;
  status?: DecisionStatus;
  impact: DecisionImpact;
  systems?: string[];
  tags?: string[];
  runId?: string;
}

// ── Issue ─────────────────────────────────────────────────────────────────────

export interface AgentIssue {
  title: string;
  description: string;
  stepsToReproduce?: string[];
  impact?: string;
  severity: IssueSeverity;
  systems?: string[];
  tags?: string[];
  runId?: string;
}

// ── Report ────────────────────────────────────────────────────────────────────

export interface AgentReport {
  workspaceId: string;
  period: ReportPeriod;
  periodStart: string;   // ISO date
  periodEnd: string;     // ISO date
  runCount: number;
  body: string;          // full markdown content
  tags?: string[];
}

// ── Run log entry (auto-logged from runtime) ─────────────────────────────────

export interface AgentRunLog {
  runId: string;
  agentId: string;
  workspaceId: string;
  status: 'succeeded' | 'failed' | 'needs_approval';
  summary: string;
  durationMs?: number;
  costCents?: number;
  /** Optional structured output from the agent run. */
  findings?: AgentFinding[];
  tasks?: AgentTask[];
  decisions?: AgentDecision[];
  issues?: AgentIssue[];
}
