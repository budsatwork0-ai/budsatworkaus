/**
 * Static workflow chain definitions for the Buds At Work agent system.
 *
 * Workflows describe relationships between agents — who feeds whom, what
 * order operations run in, and which business function a chain serves.
 * The Foreman reads these to understand bottlenecks and workflow health.
 * The ForemanConsole reads these to render flow diagrams.
 *
 * When you add a new agent, add it to the appropriate workflow here and
 * update agent_workflow_memberships in the DB (migration 044_foreman.sql).
 */

export type WorkflowType = 'sequential' | 'parallel' | 'swarm';
export type WorkflowDomain = 'customer' | 'operations' | 'finance' | 'growth' | 'compliance' | 'talent';

export interface AgentWorkflow {
  id: string;
  label: string;
  description: string;
  domain: WorkflowDomain;
  type: WorkflowType;
  /** Agent IDs in execution order. Parallel workflows list by logical grouping. */
  chain: string[];
  /** Which adaptive section this workflow surfaces under in the lobby. */
  sectionId: string;
}

export const WORKFLOWS: AgentWorkflow[] = [
  {
    id: 'customer-acquisition',
    label: 'Customer Acquisition',
    description: 'From first contact through to a confirmed, scheduled job.',
    domain: 'customer',
    type: 'sequential',
    chain: ['phone-transcriber', 'customer-reply', 'quote-triage', 'lead-scorer', 'scheduling', 'crew-briefing'],
    sectionId: 'customer-pipeline',
  },
  {
    id: 'job-delivery',
    label: 'Job Delivery',
    description: 'Scheduling through job completion, photo QA, and crew feedback.',
    domain: 'operations',
    type: 'sequential',
    chain: ['scheduling', 'photo-qa', 'yard-map-geo', 'crew-briefing', 'crew-coach'],
    sectionId: 'live-operations',
  },
  {
    id: 'revenue-intelligence',
    label: 'Revenue Intelligence',
    description: 'Financial reconciliation, cash flow forecasting, dispute handling, and pricing.',
    domain: 'finance',
    type: 'sequential',
    chain: ['reconciliation', 'cash-flow-forecaster', 'stripe-dispute-manager', 'price-optimizer'],
    sectionId: 'finance-risk',
  },
  {
    id: 'growth-loop',
    label: 'Growth Loop',
    description: 'SEO, content production, conversion optimisation, and competitive intelligence.',
    domain: 'growth',
    type: 'parallel',
    chain: ['seo-meta', 'copy-optimizer', 'content-agent', 'ab-test-architect', 'conversion-funnel', 'competitor-scout'],
    sectionId: 'growth-systems',
  },
  {
    id: 'compliance-safety',
    label: 'Compliance & Safety',
    description: 'NDIS compliance checks, participant matching, and WHS safety reminders.',
    domain: 'compliance',
    type: 'sequential',
    chain: ['ndis-compliance', 'ndis-plan-matcher', 'whs-safety-reminder'],
    sectionId: 'compliance',
  },
  {
    id: 'talent-pipeline',
    label: 'Talent Pipeline',
    description: 'Applicant screening, crew onboarding, coaching, and review management.',
    domain: 'talent',
    type: 'sequential',
    chain: ['applicant-screener', 'crew-coach', 'reviews'],
    sectionId: 'live-operations',
  },
  {
    id: 'win-back',
    label: 'Win-Back Loop',
    description: 'Re-engaging lapsed customers through targeted outreach and lead re-scoring.',
    domain: 'customer',
    type: 'sequential',
    chain: ['lapsed-win-back', 'customer-reply', 'lead-scorer'],
    sectionId: 'customer-pipeline',
  },
];

/** Map from agentId → all workflows that include that agent. */
export function workflowsByAgent(): Map<string, AgentWorkflow[]> {
  const map = new Map<string, AgentWorkflow[]>();
  for (const w of WORKFLOWS) {
    for (const agentId of w.chain) {
      const list = map.get(agentId) ?? [];
      list.push(w);
      map.set(agentId, list);
    }
  }
  return map;
}

/** All agent IDs that appear in at least one workflow. */
export const WORKFLOW_AGENT_IDS = new Set(WORKFLOWS.flatMap((w) => w.chain));
