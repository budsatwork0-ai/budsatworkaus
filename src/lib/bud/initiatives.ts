/**
 * Initiative Engine
 *
 * Bud proactively turns repeating signals into missions: "reduce dashboard
 * clutter", "fix repeated parse failures", "improve quote conversion".
 * Each mission carries why-it-matters, expected impact, confidence, and
 * the agents Bud thinks should run it.
 */
import type { MissionControlHealth } from './health';
import type { UxEvolutionRecommendation } from './ux-evolution-engine';
import type { StructuredFailure } from './structured-failure';

export type BudInitiative = {
  id: string;
  title: string;
  why: string;
  expected_impact: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  assigned_agents: string[];
  signals: string[];
  status: 'proposed' | 'in_progress' | 'blocked';
  category: 'reliability' | 'design' | 'conversion' | 'efficiency' | 'compliance';
};

export function buildBudInitiatives(args: {
  commandState: MissionControlHealth;
  uxEvolution: UxEvolutionRecommendation[];
  structuredFailures: StructuredFailure[];
}): BudInitiative[] {
  const initiatives: BudInitiative[] = [];
  const { commandState, uxEvolution, structuredFailures } = args;

  // Reliability initiatives - repeated failure patterns
  const failuresByType = new Map<string, StructuredFailure[]>();
  for (const failure of structuredFailures) {
    const list = failuresByType.get(failure.errorType) ?? [];
    list.push(failure);
    failuresByType.set(failure.errorType, list);
  }
  for (const [errorType, group] of failuresByType.entries()) {
    if (group.length < 2) continue;
    const agents = Array.from(new Set(group.map((g) => g.agentName)));
    initiatives.push({
      id: `init-reliability-${errorType.toLowerCase()}`,
      title: `Fix repeated ${errorType.replaceAll('_', ' ').toLowerCase()} failures`,
      why: `${group.length} agents have hit ${errorType.replaceAll('_', ' ').toLowerCase()} in the last 7 days.`,
      expected_impact: 'Restore agent reliability, unblock dependent workflows, recover lost runs.',
      confidence: Math.min(0.95, 0.5 + group.length * 0.1),
      severity: errorType === 'PERMISSION_DENIED' ? 'critical' : group.length >= 4 ? 'high' : 'medium',
      assigned_agents: agents.slice(0, 4),
      signals: [
        `${group.length} structured failures share this error type`,
        ...group.slice(0, 2).map((g) => `${g.agentName}: ${g.failedStep}`),
      ],
      status: 'proposed',
      category: 'reliability',
    });
  }

  // Broken agents -> reliability mission
  const broken = commandState.agents.filter((a) => a.health.label === 'broken');
  if (broken.length > 0) {
    initiatives.push({
      id: 'init-broken-agents',
      title: 'Restore broken agents to healthy',
      why: `${broken.length} agent${broken.length === 1 ? ' is' : 's are'} broken right now.`,
      expected_impact: 'Workforce reaches "nominal" and Bud can resume normal operations.',
      confidence: 0.9,
      severity: 'critical',
      assigned_agents: broken.map((b) => b.name).slice(0, 5),
      signals: broken.slice(0, 3).map((b) => `${b.name}: ${b.recommended_action}`),
      status: broken.some((b) => b.lifecycle === 'awaiting_review') ? 'blocked' : 'proposed',
      category: 'reliability',
    });
  }

  // Approval backlog
  if (commandState.approvals.total_pending >= 3) {
    initiatives.push({
      id: 'init-approval-backlog',
      title: 'Simplify approvals',
      why: `${commandState.approvals.total_pending} items are waiting for human decisions.`,
      expected_impact: 'Bud moves faster on low-risk fixes; humans focus on judgement calls.',
      confidence: 0.7,
      severity: commandState.approvals.total_pending >= 8 ? 'high' : 'medium',
      assigned_agents: ['Bud OS', 'admin-ux-designer'],
      signals: [`${commandState.approvals.pending_agent_actions} agent actions pending`, `${commandState.approvals.pending_bud_approvals} Bud approvals pending`],
      status: 'proposed',
      category: 'efficiency',
    });
  }

  // Layout / clutter initiatives from UX evolution
  const layoutSignals = uxEvolution.filter((r) =>
    r.affected_area.toLowerCase().includes('layout') ||
    r.affected_area.toLowerCase().includes('dashboard') ||
    r.title.toLowerCase().includes('clutter'),
  );
  if (layoutSignals.length >= 2) {
    initiatives.push({
      id: 'init-reduce-clutter',
      title: 'Reduce dashboard clutter',
      why: `${layoutSignals.length} UX signals flag dense, duplicated, or low-value surfaces.`,
      expected_impact: 'Faster operational reads, fewer clicks, less cognitive overload.',
      confidence: 0.65,
      severity: 'medium',
      assigned_agents: ['layout-critic', 'admin-ux-designer', 'heatmap-analyst'],
      signals: layoutSignals.slice(0, 3).map((s) => s.title),
      status: 'proposed',
      category: 'design',
    });
  }

  // Conversion drop signals
  const conversionSignals = uxEvolution.filter((r) =>
    r.title.toLowerCase().includes('conversion') ||
    r.title.toLowerCase().includes('quote') ||
    r.title.toLowerCase().includes('drop'),
  );
  if (conversionSignals.length > 0) {
    initiatives.push({
      id: 'init-improve-conversion',
      title: 'Improve quote conversion',
      why: `${conversionSignals.length} signal${conversionSignals.length === 1 ? '' : 's'} point at conversion or drop-off issues.`,
      expected_impact: 'Recover lost revenue at the top of the funnel.',
      confidence: 0.55,
      severity: 'high',
      assigned_agents: ['conversion-funnel', 'ab-test-architect', 'copy-optimizer'],
      signals: conversionSignals.slice(0, 3).map((s) => s.title),
      status: 'proposed',
      category: 'conversion',
    });
  }

  // Memory gap -> learning initiative
  if (!commandState.memory.connected || commandState.memory.recent_count === 0) {
    initiatives.push({
      id: 'init-bootstrap-memory',
      title: 'Bootstrap Bud memory',
      why: 'Bud has no operational memory to learn from outcomes or reference past fixes.',
      expected_impact: 'Repeat problems get fixed faster as Bud accumulates context.',
      confidence: 0.5,
      severity: 'medium',
      assigned_agents: ['Bud OS'],
      signals: ['Memory vault not yet synced'],
      status: 'blocked',
      category: 'efficiency',
    });
  }

  // Deployment failures -> repair automation
  if (commandState.deployment.status === 'failed') {
    initiatives.push({
      id: 'init-repair-deployment',
      title: 'Stabilize deployment pipeline',
      why: 'Latest deployment signal failed; verification cannot confirm repairs.',
      expected_impact: 'Bud can complete the deploy-verify cycle and earn higher autonomy.',
      confidence: 0.8,
      severity: 'critical',
      assigned_agents: ['Bud OS', 'github-historian', 'internal-qa'],
      signals: [commandState.deployment.summary],
      status: 'in_progress',
      category: 'reliability',
    });
  }

  return initiatives.sort((a, b) => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 };
    return sev[a.severity] - sev[b.severity];
  });
}
