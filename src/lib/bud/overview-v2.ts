/**
 * Mission Control Overview v2 — operator view model
 *
 * Derives an operator-focused projection from the existing Bud data without
 * inventing new domain state. Every field here maps to a real signal already
 * flowing into the page (commandState, queue items, repair sessions, etc.).
 *
 * Design rules:
 *  - Operator first. Translate telemetry into impact statements.
 *  - One global truth state (Healthy / Degraded / Blocked / Recovering).
 *  - Hide gates/stages until they are active.
 *  - Confidence ties to evidence. No deployment state without deployment proof.
 *  - No AI-theatre vocabulary ("quorum", "constitution", "surgical", etc.).
 */
import type { MissionControlHealth } from './health';
import type { BudActivityEvent } from './types';
import type { BudOsQueueItem, BudOsRepairWorkspace } from './os-view-model';
import type { StructuredFailure } from './structured-failure';
import type { BudThought } from './thought-stream';
import type { UxEvolutionRecommendation } from './ux-evolution-engine';

/* ────────────────────────────────────────────────────────────────────────── */
/*                              GLOBAL TRUTH STATE                            */
/* ────────────────────────────────────────────────────────────────────────── */

export type GlobalTruthState = 'healthy' | 'degraded' | 'approval' | 'blocked' | 'recovering';

export type GlobalTruth = {
  state: GlobalTruthState;
  headline: string;
  detail: string;
  /** Single integer 0-100 representing platform health. Derived, not invented. */
  index: number;
};

export function deriveGlobalTruth(commandState: MissionControlHealth): GlobalTruth {
  const c = commandState.counts;
  const hardBlocked = commandState.deployment.status === 'failed' || c.broken_agents > 0;
  const awaitingDecision =
    !hardBlocked &&
    (c.blocked_repairs > 0 ||
      c.pending_approvals > 0 ||
      commandState.repair_sessions.some((s) => s.phase === 'awaiting_approval' || s.phase === 'blocked'));
  const recovering =
    commandState.global_status === 'repairing' ||
    commandState.operating_mode === 'repairing' ||
    commandState.operating_mode === 'verifying' ||
    commandState.repair_sessions.some((s) =>
      ['repairing', 'patching', 'validating', 'verifying', 'deploying', 'monitoring'].includes(s.phase),
    );
  const degraded =
    c.failed_runs > 0 ||
    c.broken_agents > 0 ||
    c.needs_repair_agents > 0 ||
    c.watch_agents > 0 ||
    c.parse_failures > 0 ||
    c.unresolved_alerts > 0 ||
    c.low_success_rate_agents > 0 ||
    c.pending_approvals > 0;

  let state: GlobalTruthState;
  if (hardBlocked) state = 'blocked';
  else if (recovering) state = 'recovering';
  else if (awaitingDecision) state = 'approval';
  else if (degraded) state = 'degraded';
  else state = 'healthy';

  const deductions =
    c.broken_agents * 12 +
    c.needs_repair_agents * 7 +
    c.failed_runs * 3 +
    c.parse_failures * 4 +
    c.watch_agents * 2 +
    c.pending_approvals * 1 +
    c.unresolved_alerts * 2 +
    c.blocked_repairs * 15;
  const index = Math.max(0, Math.min(100, 100 - deductions));

  const headline = ({
    healthy: 'Healthy',
    degraded: 'Degraded',
    approval: 'Awaiting decision',
    blocked: 'Blocked',
    recovering: 'Recovering',
  } as const)[state];

  const detail =
    state === 'healthy'
      ? 'No active incidents. Platform is operating within expected envelopes.'
      : state === 'blocked'
        ? buildBlockedDetail(commandState)
        : state === 'approval'
          ? buildApprovalDetail(commandState)
          : state === 'recovering'
            ? buildRecoveringDetail(commandState)
            : buildDegradedDetail(commandState);

  return { state, headline, detail, index };
}

function buildDegradedDetail(c: MissionControlHealth): string {
  const parts: string[] = [];
  if (c.counts.broken_agents > 0) parts.push(`${c.counts.broken_agents} broken capabilit${c.counts.broken_agents === 1 ? 'y' : 'ies'}`);
  if (c.counts.failed_runs > 0) parts.push(`${c.counts.failed_runs} failed run${c.counts.failed_runs === 1 ? '' : 's'}`);
  if (c.counts.pending_approvals > 0) parts.push(`${c.counts.pending_approvals} awaiting decision`);
  if (parts.length === 0) parts.push('minor watch signals');
  return `${parts.join(' · ')}. No customer-facing outage detected.`;
}

function buildRecoveringDetail(c: MissionControlHealth): string {
  const active = c.repair_sessions.filter((s) =>
    ['repairing', 'patching', 'validating', 'verifying', 'deploying'].includes(s.phase),
  ).length;
  if (active === 0) return 'A repair pipeline is in flight.';
  return `${active} repair${active === 1 ? '' : 's'} in flight. Holding deployment status until verification passes.`;
}

function buildBlockedDetail(c: MissionControlHealth): string {
  if (c.deployment.status === 'failed') return 'Last deployment failed. Verification gates are holding new releases.';
  if (c.counts.broken_agents > 0) return `${c.counts.broken_agents} agent${c.counts.broken_agents === 1 ? '' : 's'} halted. Treat as operationally blocked.`;
  return 'A hard operational gate is preventing forward progress.';
}

function buildApprovalDetail(c: MissionControlHealth): string {
  const waiting = c.counts.blocked_repairs + c.approvals.total_pending;
  if (waiting > 0) return `${waiting} item${waiting === 1 ? '' : 's'} awaiting operator approval. Platform remains operational.`;
  return 'Repair is pending an operator decision.';
}

export type HealthDimension = {
  key: 'platform_health' | 'repair_pipeline_health' | 'watch_agents' | 'customer_impact';
  label: string;
  value: string;
  state: GlobalTruthState;
  detail: string;
};

export function deriveHealthDimensions(args: {
  commandState: MissionControlHealth;
  failures?: StructuredFailure[];
  uxEvolution?: UxEvolutionRecommendation[];
}): HealthDimension[] {
  const { commandState } = args;
  const impact = deriveCustomerImpact({
    commandState,
    failures: args.failures ?? [],
    uxEvolution: args.uxEvolution ?? [],
  });
  const activeRepairs = commandState.repair_sessions.filter((s) =>
    ['repairing', 'patching', 'validating', 'verifying', 'deploying', 'monitoring'].includes(s.phase),
  ).length;
  const waitingRepairs =
    commandState.counts.blocked_repairs +
    commandState.repair_sessions.filter((s) => s.phase === 'awaiting_approval' || s.phase === 'blocked').length;
  const platformBlocked = commandState.deployment.status === 'failed' || commandState.counts.broken_agents > 0;

  return [
    {
      key: 'platform_health',
      label: 'Platform health',
      value: platformBlocked ? 'Platform intervention required' : 'Platform operational',
      state: platformBlocked ? 'blocked' : 'healthy',
      detail: commandState.deployment.status === 'failed'
        ? 'Last deployment failed verification.'
        : `${commandState.agents.length} agents registered.`,
    },
    {
      key: 'repair_pipeline_health',
      label: 'Repair pipeline',
      value: waitingRepairs > 0
        ? `${waitingRepairs} repair${waitingRepairs === 1 ? '' : 's'} pending approval`
        : activeRepairs > 0
          ? `${activeRepairs} repair${activeRepairs === 1 ? '' : 's'} in flight`
          : 'No active repair pressure',
      state: waitingRepairs > 0 ? 'approval' : activeRepairs > 0 ? 'recovering' : 'healthy',
      detail: waitingRepairs > 0 ? 'Operator threshold or approval is holding execution.' : commandState.deployment.summary,
    },
    {
      key: 'watch_agents',
      label: 'Watch agents',
      value: commandState.counts.watch_agents > 0
        ? `${commandState.counts.watch_agents} watch agent${commandState.counts.watch_agents === 1 ? '' : 's'} degraded`
        : 'Watch agents normal',
      state: commandState.counts.watch_agents > 0 ? 'degraded' : 'healthy',
      detail: commandState.counts.watch_agents > 0 ? 'Internal optimization only. No customer impact by default.' : 'Monitoring output is within expected bounds.',
    },
    {
      key: 'customer_impact',
      label: 'Customer impact',
      value: impact.length > 0 ? `${impact.length} customer-facing signal${impact.length === 1 ? '' : 's'}` : 'No customer impact',
      state: impact.some((i) => i.severity === 'critical') ? 'blocked' : impact.length > 0 ? 'degraded' : 'healthy',
      detail: impact.length > 0 ? 'Review affected surfaces before deploy.' : 'Current signals are internal optimization or background monitoring.',
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              OPERATIONAL RISK                              */
/* ────────────────────────────────────────────────────────────────────────── */

export type OpRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type OpRiskVector = {
  key: 'revenue' | 'ux' | 'deployment' | 'conversion' | 'crew';
  label: string;
  level: OpRiskLevel;
  detail: string;
  /** Human-impact translation of the underlying signal. */
  impact: string;
};

export function deriveOperationalRisk(args: {
  commandState: MissionControlHealth;
  failures: StructuredFailure[];
  /** Reserved for future signal weighting from open queue items. */
  queue?: BudOsQueueItem[];
  uxEvolution: UxEvolutionRecommendation[];
}): OpRiskVector[] {
  const { commandState, failures, uxEvolution } = args;

  const businessAgents = commandState.agents.filter((a) =>
    ['Customer', 'Finance', 'Growth'].includes(a.category) ||
    /quote|booking|stripe|price|payment|invoice/i.test(a.name),
  );
  const businessBroken = businessAgents.filter((a) => a.health.label === 'broken').length;
  const revenueLevel: OpRiskLevel = businessBroken > 0 ? 'high' : commandState.counts.failed_runs > 2 ? 'medium' : 'low';

  const uxCritical = uxEvolution.filter((u) => u.severity === 'critical').length;
  const uxHigh = uxEvolution.filter((u) => u.severity === 'high').length;
  const uxLevel: OpRiskLevel = uxCritical > 0 ? 'high' : uxHigh > 1 ? 'medium' : 'low';

  const deploymentLevel: OpRiskLevel =
    commandState.deployment.status === 'failed'
      ? 'critical'
      : commandState.deployment.status === 'deploying'
        ? 'medium'
        : commandState.deployment.status === 'stale'
          ? 'medium'
          : 'low';

  const conversionFailures = failures.filter((f) =>
    /quote|booking|checkout|map|geo|stripe/i.test(`${f.agentName} ${f.failedStep} ${f.message}`),
  ).length;
  const conversionLevel: OpRiskLevel = conversionFailures > 1 ? 'medium' : conversionFailures > 0 ? 'medium' : 'low';

  const crewAgents = commandState.agents.filter((a) =>
    a.category === 'Customer' || /crew|scheduling|safety|whs/i.test(a.name),
  );
  const crewBroken = crewAgents.filter((a) => a.health.label !== 'healthy' && a.health.label !== 'inactive').length;
  const crewLevel: OpRiskLevel = crewBroken > 2 ? 'high' : crewBroken > 0 ? 'medium' : 'low';

  return [
    {
      key: 'revenue',
      label: 'Revenue',
      level: revenueLevel,
      detail: `${businessBroken} payment/quote/price-touching capabilit${businessBroken === 1 ? 'y' : 'ies'} affected.`,
      impact: revenueLevel === 'high'
        ? 'Revenue path is exposed. Track conversion until the affected capability recovers.'
        : revenueLevel === 'medium'
          ? 'Background failures could compound into revenue impact within the day.'
          : 'No measurable revenue exposure right now.',
    },
    {
      key: 'ux',
      label: 'UX',
      level: uxLevel,
      detail: `${uxCritical + uxHigh} high-severity UX signal${uxCritical + uxHigh === 1 ? '' : 's'}.`,
      impact: uxLevel === 'high'
        ? 'Users are likely encountering friction on at least one core flow.'
        : uxLevel === 'medium'
          ? 'A few friction signals are accumulating in the queue.'
          : 'No active UX regressions reported.',
    },
    {
      key: 'deployment',
      label: 'Deployment',
      level: deploymentLevel,
      detail: commandState.deployment.summary,
      impact: deploymentLevel === 'critical'
        ? 'New deploys are blocked. Last release did not verify.'
        : deploymentLevel === 'medium'
          ? 'Deployment surface is in motion or stale. Verify before promoting new work.'
          : 'Deploy pipeline is calm.',
    },
    {
      key: 'conversion',
      label: 'Conversion',
      level: conversionLevel,
      detail: `${conversionFailures} signal${conversionFailures === 1 ? '' : 's'} touching quote / booking flow.`,
      impact: conversionLevel === 'medium'
        ? 'Watch quote drop-off rate over the next few hours.'
        : 'Quote-to-booking flow is operating normally.',
    },
    {
      key: 'crew',
      label: 'Crew',
      level: crewLevel,
      detail: `${crewBroken} crew-facing capabilit${crewBroken === 1 ? 'y' : 'ies'} degraded.`,
      impact: crewLevel === 'high'
        ? 'Field crew is likely to feel scheduling or safety degradation today.'
        : crewLevel === 'medium'
          ? 'A crew workflow is wobbling. Confirm with the duty manager.'
          : 'Crew workflows are running cleanly.',
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              INTENT CLASSIFIER                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type SignalIntent = 'runtime_error' | 'infra_failure' | 'ux_issue' | 'investigation' | 'command' | 'discussion';

export type ClassifiedSignal = {
  id: string;
  source: BudOsQueueItem['source'];
  intent: SignalIntent;
  shouldTriggerRepair: boolean;
  reason: string;
};

export function classifyIntent(item: BudOsQueueItem): ClassifiedSignal {
  const text = `${item.title} ${item.detail}`.toLowerCase();
  let intent: SignalIntent;
  let shouldTriggerRepair = false;
  let reason: string;

  if (item.source === 'agent_run' || item.source === 'agent_health') {
    if (/permission|forbidden|rls|credential/.test(text)) {
      intent = 'infra_failure';
      shouldTriggerRepair = false;
      reason = 'Auth/permission failure — needs human credential check, not autonomous repair.';
    } else {
      intent = 'runtime_error';
      shouldTriggerRepair = item.severity === 'critical' || item.severity === 'high';
      reason = shouldTriggerRepair
        ? 'Concrete runtime failure with actionable signal.'
        : `Severity is ${item.severity} — raise to high or critical to auto-trigger repair.`;
    }
  } else if (item.source === 'ux_evolution') {
    intent = 'ux_issue';
    shouldTriggerRepair = false;
    reason = 'UX recommendation — review and approve, do not auto-patch.';
  } else if (item.source === 'bud_approval') {
    intent = 'command';
    shouldTriggerRepair = false;
    reason = 'Already inside the approval pipeline.';
  } else if (item.source === 'bud_insight') {
    intent = 'investigation';
    shouldTriggerRepair = false;
    reason = 'Observation worth investigating. Repair only after diagnosis.';
  } else if (item.source === 'repair_session') {
    intent = 'investigation';
    shouldTriggerRepair = false;
    reason = 'Repair already in flight or completed.';
  } else if (item.source === 'bud_task') {
    intent = 'command';
    shouldTriggerRepair = false;
    reason = 'Already a tracked task.';
  } else if (item.source === 'agent_action') {
    intent = 'command';
    shouldTriggerRepair = false;
    reason = 'Proposed action waiting for human decision.';
  } else {
    intent = 'discussion';
    shouldTriggerRepair = false;
    reason = 'Unclassified — discuss before acting.';
  }

  return { id: item.id, source: item.source, intent, shouldTriggerRepair, reason };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              INCIDENT DEDUP                                */
/* ────────────────────────────────────────────────────────────────────────── */

export type CanonicalIncident = {
  key: string;
  title: string;
  summary: string;
  severity: BudOsQueueItem['severity'];
  agentName: string | null;
  intent: SignalIntent;
  occurrences: number;
  lastSeenAt: string;
  /** All queue items rolled into this canonical incident. */
  signals: BudOsQueueItem[];
};

function canonicalKey(item: BudOsQueueItem): string {
  const agent = item.agent_name ?? item.agent_id ?? 'system';
  if (item.source === 'agent_health') return `health:${agent}`;
  if (item.source === 'agent_run') return `run-failure:${failureSignature(item)}`;
  if (item.source === 'bud_insight') return `insight:${slug(item.title)}`;
  if (item.source === 'ux_evolution') return `ux:${slug(item.title)}`;
  if (item.source === 'bud_approval' || item.source === 'agent_action') return `pending:${item.id}`;
  return item.id;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
}

function failureSignature(item: BudOsQueueItem): string {
  const normalised = `${item.title} ${item.detail}`
    .toLowerCase()
    .replace(/[a-f0-9]{7,40}/g, '<hash>')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/[^a-z0-9<>]+/g, ' ')
    .trim();
  return slug(normalised) || (item.agent_id ?? 'runtime');
}

export function deduplicateSignals(items: BudOsQueueItem[]): CanonicalIncident[] {
  const map = new Map<string, CanonicalIncident>();
  for (const item of items) {
    const key = canonicalKey(item);
    const classified = classifyIntent(item);
    const existing = map.get(key);
    if (existing) {
      existing.occurrences += 1;
      if (new Date(item.created_at).getTime() > new Date(existing.lastSeenAt).getTime()) {
        existing.lastSeenAt = item.created_at;
      }
      if (severityRank(item.severity) > severityRank(existing.severity)) {
        existing.severity = item.severity;
      }
      existing.signals.push(item);
    } else {
      map.set(key, {
        key,
        title: item.title,
        summary: item.detail,
        severity: item.severity,
        agentName: item.agent_name,
        intent: classified.intent,
        occurrences: 1,
        lastSeenAt: item.created_at,
        signals: [item],
      });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity) || b.occurrences - a.occurrences,
  );
}

function severityRank(s: BudOsQueueItem['severity']): number {
  return ({ critical: 4, high: 3, medium: 2, low: 1 } as const)[s];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              BUD CAPABILITIES                              */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Collapse "named agent personalities" into the underlying Bud capability the
 * operator should think about. Map by agent name patterns rather than
 * inventing new identities.
 */
export type BudCapabilityActivity = {
  capability: string;
  description: string;
  level: 'idle' | 'active' | 'attention';
};

const CAPABILITY_MAP: Array<{ match: RegExp; capability: string }> = [
  { match: /ux|design|layout|admin-ux/i, capability: 'Reviewing UX' },
  { match: /accessibility|a11y/i, capability: 'Validating accessibility' },
  { match: /quote|pricing|price/i, capability: 'Watching quote flow' },
  { match: /scheduling|crew|whs|safety/i, capability: 'Coordinating crew' },
  { match: /stripe|invoice|cash|reconcil|payment/i, capability: 'Revenue telemetry stable' },
  { match: /seo|copy|content|competitor|review/i, capability: 'Conversion monitoring active' },
  { match: /heatmap|ab[-_ ]test|intelligence|analytic/i, capability: 'Reading intelligence signals' },
  { match: /github|qa|ndis|compliance|historian/i, capability: 'Maintaining infrastructure' },
  { match: /customer|reply|applicant|lead|transcrib|coach|map/i, capability: 'Customer systems monitored' },
];

export function capabilityFor(agentName: string | null): string {
  if (!agentName) return 'General oversight';
  for (const entry of CAPABILITY_MAP) {
    if (entry.match.test(agentName)) return entry.capability;
  }
  return 'General oversight';
}

export function activeCapabilities(commandState: MissionControlHealth): BudCapabilityActivity[] {
  const out = new Map<string, BudCapabilityActivity>();
  for (const agent of commandState.agents) {
    const cap = capabilityFor(agent.name);
    const existing = out.get(cap);
    const level: BudCapabilityActivity['level'] =
      agent.health.label === 'broken' || agent.health.label === 'needs_repair'
        ? 'attention'
        : agent.lifecycle === 'active' || agent.lifecycle === 'awaiting_review'
          ? 'active'
          : 'idle';
    if (!existing) {
      out.set(cap, {
        capability: cap,
        description: levelDescription(cap, level),
        level,
      });
    } else if (severityForLevel(level) > severityForLevel(existing.level)) {
      existing.level = level;
      existing.description = levelDescription(cap, level);
    }
  }
  return Array.from(out.values()).sort(
    (a, b) => severityForLevel(b.level) - severityForLevel(a.level),
  );
}

function severityForLevel(level: BudCapabilityActivity['level']): number {
  return ({ attention: 2, active: 1, idle: 0 } as const)[level];
}

function levelDescription(cap: string, level: BudCapabilityActivity['level']): string {
  if (level === 'attention') return `${cap} needs operator review.`;
  if (level === 'active') return cap;
  return `${cap} in background.`;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                       STRUCTURED OPERATIONAL SUMMARY                       */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Turn the noisy thought stream into operator-grade cause/result lines.
 */
export type OperationalSummaryEntry = {
  id: string;
  at: string;
  kind: 'cause' | 'result' | 'wait' | 'observe';
  text: string;
};

export function buildOperationalSummaries(args: {
  thoughts: BudThought[];
  failures: StructuredFailure[];
  commandState: MissionControlHealth;
  limit?: number;
}): OperationalSummaryEntry[] {
  const out: OperationalSummaryEntry[] = [];

  for (const thought of args.thoughts) {
    if (thought.state === 'observing') continue; // drop "watching for changes" noise
    if (thought.state === 'thinking') continue; // remove free-form pondering
    out.push({
      id: thought.id,
      at: thought.at,
      kind: thought.state === 'blocked'
        ? 'cause'
        : thought.state === 'waiting'
          ? 'wait'
          : thought.state === 'learning' || thought.state === 'verifying'
            ? 'result'
            : 'observe',
      text: humanise(thought.narrative, thought.state),
    });
  }

  for (const f of args.failures.slice(0, 5)) {
    out.push({
      id: `failure-summary-${f.runId}`,
      at: f.createdAt,
      kind: 'cause',
      text: `${f.agentName} ${describeStep(f.failedStep)} failed because ${f.suspectedCause.toLowerCase()}`,
    });
  }

  // Sort newest first; cap.
  out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return out.slice(0, args.limit ?? 8);
}

function describeStep(step: string): string {
  return step.replaceAll('_', ' ');
}

function humanise(narrative: string, _state: BudThought['state']): string {
  // Strip internal chain-of-thought narration and flashy phrases.
  // Operators should see cause / action / result — not LLM reasoning steps.
  return narrative
    // Remove first-person internal access narration ("I'm accessing X...", "I'm reading Y")
    .replace(/\bI'?m\s+(?:accessing|reading|scanning|searching|reviewing|looking\s+at|checking|fetching)\s+[^\s.]+\.?\.\./gi, '')
    // Remove first-person framing
    .replace(/\bI'?(?:ve|m| am| have)\s+(?:found|identified|noticed|detected|confirmed|determined)\s*/gi, '')
    // Strip AI-theatre vocabulary
    .replace(/surgical/gi, 'targeted')
    .replace(/quorum/gi, 'review')
    .replace(/constitution/gi, 'design rules')
    .replace(/self[- ]heal(ing)?/gi, 'repair$1')
    .replace(/autonomous (?:operator|fleet)/gi, 'Bud')
    .replace(/\bBud OS\b/gi, 'Bud')
    // Collapse multiple spaces and leading punctuation left by removals
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[·,.\s]+/, '')
    .trim();
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              COCKPIT SUMMARY                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type CockpitRecommendation = {
  id: string;
  label: string;
  /** Operator-readable explanation of why this is recommended now. */
  reason: string;
  priority: 'critical' | 'major' | 'medium' | 'minor';
  /** When set, the operator can act through the existing approve/investigate handlers. */
  linkedItemId: string | null;
};

export type CockpitSummary = {
  headline: string;
  body: string;
  recommendations: CockpitRecommendation[];
};

export function buildCockpitSummary(args: {
  truth: GlobalTruth;
  commandState: MissionControlHealth;
  incidents: CanonicalIncident[];
  risk: OpRiskVector[];
}): CockpitSummary {
  const { truth, commandState, incidents, risk } = args;
  const critical = incidents.filter((i) => i.severity === 'critical');
  const high = incidents.filter((i) => i.severity === 'high');
  const approvalsPending = commandState.approvals.total_pending;

  const headline = truth.state === 'healthy'
    ? 'Platform is operating cleanly.'
    : truth.state === 'blocked'
      ? 'Platform intervention is required.'
      : truth.state === 'approval'
        ? 'Repair is pending operator approval.'
        : truth.state === 'recovering'
          ? 'A repair is in flight. Verification is in progress.'
          : `${critical.length + high.length} issue${critical.length + high.length === 1 ? '' : 's'} need attention.`;

  const bodyParts: string[] = [];
  if (approvalsPending > 0) {
    bodyParts.push(`${approvalsPending} item${approvalsPending === 1 ? '' : 's'} awaiting your decision`);
  }
  const elevatedRisk = risk.filter((r) => r.level === 'high' || r.level === 'critical');
  if (elevatedRisk.length > 0) {
    bodyParts.push(`${elevatedRisk.map((r) => r.label.toLowerCase()).join(', ')} risk elevated`);
  }
  if (commandState.deployment.status === 'failed') {
    bodyParts.push('last deploy did not verify');
  }
  if (bodyParts.length === 0) bodyParts.push('Background watch only — no immediate operator action');

  const body = capitalise(bodyParts.join(' · ')) + '.';

  const recommendations: CockpitRecommendation[] = [];
  for (const incident of critical.slice(0, 2)) {
    recommendations.push({
      id: incident.key,
      label: incident.title,
      reason: `Critical: ${incident.summary}`,
      priority: 'critical',
      linkedItemId: incident.signals[0]?.id ?? null,
    });
  }
  if (recommendations.length < 3 && approvalsPending > 0) {
    recommendations.push({
      id: 'approvals-pending',
      label: `Review ${approvalsPending} pending approval${approvalsPending === 1 ? '' : 's'}`,
      reason: 'Bud has drafted work but cannot deploy until you decide.',
      priority: 'major',
      linkedItemId: null,
    });
  }
  for (const incident of high.slice(0, 3 - recommendations.length)) {
    recommendations.push({
      id: incident.key,
      label: incident.title,
      reason: incident.summary,
      priority: 'major',
      linkedItemId: incident.signals[0]?.id ?? null,
    });
  }
  if (recommendations.length === 0 && truth.state !== 'healthy') {
    recommendations.push({
      id: 'open-diagnostics',
      label: 'Open Diagnostics for the full pipeline trace',
      reason: 'No urgent action — switch modes if you want to inspect internals.',
      priority: 'minor',
      linkedItemId: null,
    });
  }

  return { headline, body, recommendations };
}

function capitalise(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          HARD EXECUTION STATES                             */
/* ────────────────────────────────────────────────────────────────────────── */

export type ExecutionState = 'proposed' | 'patched' | 'tested' | 'approved' | 'deployed' | 'verified';
export type OrchestrationPhase =
  | 'investigation'
  | 'root_cause'
  | 'diff_generated'
  | 'sandbox_validation'
  | 'ux_review'
  | 'browser_simulation'
  | 'human_approval'
  | 'deploy'
  | 'live_verification';

export type ExecutionEvidence = {
  state: ExecutionState;
  reached: boolean;
  /** Concrete proof that this state was reached. */
  evidence: string | null;
  /** When this state can't be reached because of a real block. */
  blocker: string | null;
};

export type OrchestrationEvidence = {
  phase: OrchestrationPhase;
  reached: boolean;
  evidence: string | null;
  blocker: string | null;
};

export function deriveExecutionStates(workspace: BudOsRepairWorkspace): ExecutionEvidence[] {
  const proposedReached = Boolean(workspace.task_id || workspace.diagnosis);
  // sandbox_branch alone is not proof of a patch — a branch can be created before any code is written.
  // Require a PR URL or a substantive diff string.
  const patchedReached = Boolean(
    workspace.pr_url ||
    workspace.diff_summary?.startsWith('http') ||
    (workspace.diff_summary &&
      workspace.diff_summary !== 'No code/config diff has been produced yet.' &&
      workspace.diff_summary.length > 30),
  );
  const ciPassed = workspace.ci_conclusion === 'success';
  const ciFailed = workspace.ci_conclusion === 'failure';
  const browserPassed = workspace.browser_test_status === 'passed' || (workspace.browser_tests_total != null && workspace.browser_tests_failed === 0 && workspace.browser_tests_total > 0);
  const tastePassed = workspace.taste_pass === true;
  const tasteFailed = workspace.taste_pass === false;
  const testedReached = ciPassed && (workspace.browser_tests_total == null || browserPassed) && !tasteFailed;
  const approvedReached = /no approval pending/i.test(workspace.approval_status) === false && /approved/i.test(workspace.approval_status);
  const deployedReached = Boolean(workspace.deployment_url);
  // Cannot be verified live without a deployment — gate explicitly.
  const verifiedReached = deployedReached && (workspace.verification_status === 'verified' || /recovered|verified/i.test(workspace.verification_status));

  return [
    {
      state: 'proposed',
      reached: proposedReached,
      evidence: proposedReached ? 'Bud opened a repair task with diagnosis.' : null,
      blocker: proposedReached ? null : 'No repair task drafted yet.',
    },
    {
      state: 'patched',
      reached: patchedReached,
      evidence: patchedReached
        ? workspace.pr_url ? `PR: ${workspace.pr_url}` : workspace.sandbox_branch ? `Branch: ${workspace.sandbox_branch}` : 'Diff drafted.'
        : null,
      blocker: patchedReached ? null : 'No diff produced yet.',
    },
    {
      state: 'tested',
      reached: testedReached,
      evidence: testedReached
        ? [
            ciPassed ? 'CI green' : null,
            browserPassed ? `${workspace.browser_tests_passed ?? 0}/${workspace.browser_tests_total ?? 0} browser tests passed` : null,
            tastePassed ? `Taste score ${workspace.taste_score ?? '—'}` : null,
          ].filter(Boolean).join(' · ')
        : null,
      blocker: ciFailed
        ? 'CI failed — repair must not advance.'
        : tasteFailed
          ? `Design taste failed${workspace.taste_violations.length > 0 ? `: ${workspace.taste_violations[0]}` : ''}. Blocks deployment.`
          : !testedReached
            ? 'Tests not yet passed.'
            : null,
    },
    {
      state: 'approved',
      reached: approvedReached,
      evidence: approvedReached ? 'Operator approval recorded.' : null,
      blocker: approvedReached ? null : (workspace.approval_status === 'Needs your approval' ? 'Awaiting your decision.' : null),
    },
    {
      state: 'deployed',
      reached: deployedReached,
      evidence: deployedReached ? `Deployment: ${workspace.deployment_url ?? 'recorded'}` : null,
      blocker: deployedReached ? null : 'No deployment URL recorded.',
    },
    {
      state: 'verified',
      reached: verifiedReached,
      evidence: verifiedReached ? 'Live telemetry confirmed the fix held.' : null,
      blocker: verifiedReached ? null : (deployedReached ? 'Waiting on post-deploy verification.' : null),
    },
  ];
}

export function deriveOrchestrationPhases(workspace: BudOsRepairWorkspace): OrchestrationEvidence[] {
  const hasInvestigation = Boolean(workspace.task_id || workspace.selected_item_id);
  const hasRootCause = Boolean(workspace.root_cause_type || (workspace.diagnosis && !/has not opened/i.test(workspace.diagnosis)));
  const hasDiff = Boolean(
    workspace.pr_url ||
      (workspace.diff_summary &&
        workspace.diff_summary !== 'No code/config diff has been produced yet.' &&
        workspace.diff_summary.length > 30),
  );
  const ciPassed = workspace.ci_conclusion === 'success';
  const ciFailed = workspace.ci_conclusion === 'failure';
  const uxReviewed = workspace.taste_pass === true || workspace.taste_pass === false;
  const browserRun = workspace.browser_tests_total != null && workspace.browser_tests_total > 0;
  const browserPassed = browserRun && workspace.browser_tests_failed === 0;
  const approved = /approved/i.test(workspace.approval_status);
  const needsApproval = workspace.approval_status === 'Needs your approval';
  const deployed = Boolean(workspace.deployment_url);
  const verified = deployed && (workspace.verification_status === 'verified' || /recovered|verified/i.test(workspace.verification_status));

  return [
    {
      phase: 'investigation',
      reached: hasInvestigation,
      evidence: hasInvestigation ? 'Investigation selected or opened.' : null,
      blocker: hasInvestigation ? null : 'No investigation started.',
    },
    {
      phase: 'root_cause',
      reached: hasRootCause,
      evidence: hasRootCause ? workspace.root_cause_type ?? 'Root cause summary exists.' : null,
      blocker: hasRootCause ? null : 'Root cause not established.',
    },
    {
      phase: 'diff_generated',
      reached: hasDiff,
      evidence: hasDiff ? workspace.pr_url ?? workspace.diff_summary : null,
      blocker: hasDiff ? null : 'No code diff generated.',
    },
    {
      phase: 'sandbox_validation',
      reached: ciPassed,
      evidence: ciPassed ? 'CI validation passed.' : null,
      blocker: ciFailed ? 'CI failed.' : ciPassed ? null : 'Sandbox validation pending.',
    },
    {
      phase: 'ux_review',
      reached: workspace.taste_pass === true,
      evidence: workspace.taste_pass === true ? `UX review passed${workspace.taste_score != null ? `: ${workspace.taste_score}` : ''}.` : null,
      blocker: workspace.taste_pass === false ? 'UX review failed.' : uxReviewed ? null : 'UX review pending.',
    },
    {
      phase: 'browser_simulation',
      reached: Boolean(browserPassed),
      evidence: browserPassed ? `${workspace.browser_tests_passed ?? 0}/${workspace.browser_tests_total ?? 0} browser checks passed.` : null,
      blocker: browserRun && !browserPassed ? 'Browser simulation failed.' : browserRun ? null : 'Browser simulation pending.',
    },
    {
      phase: 'human_approval',
      reached: approved,
      evidence: approved ? 'Human approval recorded.' : null,
      blocker: approved ? null : needsApproval ? 'Awaiting operator decision.' : 'No approval required yet.',
    },
    {
      phase: 'deploy',
      reached: deployed,
      evidence: deployed ? `Deployment recorded: ${workspace.deployment_url}` : null,
      blocker: deployed ? null : 'Deploy not recorded.',
    },
    {
      phase: 'live_verification',
      reached: verified,
      evidence: verified ? 'Live verification confirmed.' : null,
      blocker: verified ? null : deployed ? 'Live verification pending.' : 'Deploy first.',
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          EVIDENCE-BASED CONFIDENCE                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type EvidenceBreakdown = {
  confidence: number; // 0-100
  evidence: Array<{ label: string; weight: number; present: boolean; detail?: string }>;
  stages: Array<{
    label: 'Root cause confidence' | 'Patch safety' | 'Production confidence';
    value: number | null;
    status: string;
  }>;
};

export function deriveConfidence(workspace: BudOsRepairWorkspace): EvidenceBreakdown {
  const evidence: EvidenceBreakdown['evidence'] = [
    {
      label: 'CI passed',
      weight: 25,
      present: workspace.ci_conclusion === 'success',
      detail: workspace.ci_conclusion ?? undefined,
    },
    {
      label: 'Browser tests',
      weight: 20,
      present: workspace.browser_test_status === 'passed' || (workspace.browser_tests_total != null && workspace.browser_tests_failed === 0 && workspace.browser_tests_total > 0),
      detail: workspace.browser_tests_total != null ? `${workspace.browser_tests_passed ?? 0}/${workspace.browser_tests_total}` : 'no run',
    },
    {
      label: 'Design taste',
      weight: 15,
      present: workspace.taste_pass === true,
      detail: workspace.taste_score != null ? String(workspace.taste_score) : undefined,
    },
    {
      label: 'Deployed',
      weight: 20,
      present: Boolean(workspace.deployment_url),
      detail: workspace.deployment_url ? 'recorded' : undefined,
    },
    {
      label: 'Verified live',
      weight: 20,
      // Cannot be verified without a deployment — matches the verifiedReached gate above.
      present: Boolean(workspace.deployment_url) && (workspace.verification_status === 'verified' || /recovered|verified/i.test(workspace.verification_status)),
      detail: !workspace.deployment_url
        ? 'not deployed'
        : /verified|recovered/i.test(workspace.verification_status)
          ? 'confirmed'
          : /running|verifying/i.test(workspace.verification_status)
            ? 'in progress'
            : /blocked|failed/i.test(workspace.verification_status)
              ? 'blocked'
              : 'not started',
    },
  ];
  const total = evidence.reduce((sum, e) => sum + e.weight, 0);
  const earned = evidence.filter((e) => e.present).reduce((sum, e) => sum + e.weight, 0);
  return {
    confidence: total === 0 ? 0 : Math.round((earned / total) * 100),
    evidence,
    stages: deriveStagedConfidence(workspace),
  };
}

function deriveStagedConfidence(workspace: BudOsRepairWorkspace): EvidenceBreakdown['stages'] {
  const rootCauseSignals = [
    Boolean(workspace.task_id),
    Boolean(workspace.root_cause_type),
    Boolean(workspace.diagnosis && !/has not opened/i.test(workspace.diagnosis)),
    workspace.confidence != null,
  ].filter(Boolean).length;
  const rootCause = workspace.confidence != null
    ? Math.round(workspace.confidence * 100)
    : Math.min(85, 35 + rootCauseSignals * 12);

  const patchSignals = [
    Boolean(workspace.pr_url || (workspace.diff_summary && workspace.diff_summary.length > 30)),
    workspace.ci_conclusion === 'success',
    workspace.taste_pass === true,
    workspace.browser_test_status === 'passed' ||
      (workspace.browser_tests_total != null && workspace.browser_tests_failed === 0 && workspace.browser_tests_total > 0),
  ].filter(Boolean).length;
  const patchSafety = patchSignals === 0 ? null : Math.min(95, 20 + patchSignals * 18);

  const productionSignals = [
    Boolean(workspace.deployment_url),
    /verified|recovered/i.test(workspace.verification_status),
    workspace.repair_success_rate != null && workspace.repair_success_rate >= 0.8,
  ].filter(Boolean).length;
  const production = !workspace.deployment_url ? null : Math.min(96, 30 + productionSignals * 20);

  return [
    { label: 'Root cause confidence', value: rootCause, status: rootCauseSignals > 1 ? 'evidence available' : 'investigating' },
    { label: 'Patch safety', value: patchSafety, status: patchSafety == null ? 'pending' : patchSafety >= 70 ? 'supported by checks' : 'needs validation' },
    { label: 'Production confidence', value: production, status: production == null ? 'unavailable until deploy' : production >= 70 ? 'verification evidence available' : 'waiting on live proof' },
  ];
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              SYSTEMS MAP                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export type SystemArea = 'admin' | 'quotes' | 'crew' | 'customer' | 'public' | 'ndis';

export type SystemNode = {
  area: SystemArea;
  label: string;
  state: GlobalTruthState;
  detail: string;
};

const AREA_PATTERNS: Array<{ area: SystemArea; match: RegExp }> = [
  { area: 'admin', match: /admin|ux-designer|lobby|layout/i },
  { area: 'quotes', match: /quote|pricing|price|stripe|invoice/i },
  { area: 'crew', match: /crew|scheduling|whs|safety|briefing/i },
  { area: 'customer', match: /customer|reply|applicant|review|transcrib|lead/i },
  { area: 'public', match: /seo|copy|content|competitor|public/i },
  { area: 'ndis', match: /ndis|compliance/i },
];

export function deriveSystemsMap(commandState: MissionControlHealth): SystemNode[] {
  const buckets = new Map<SystemArea, { broken: number; degraded: number; total: number }>();
  for (const entry of AREA_PATTERNS) {
    buckets.set(entry.area, { broken: 0, degraded: 0, total: 0 });
  }

  for (const agent of commandState.agents) {
    const area = AREA_PATTERNS.find((p) => p.match.test(`${agent.name} ${agent.category}`))?.area ?? 'admin';
    const b = buckets.get(area)!;
    b.total += 1;
    if (agent.health.label === 'broken') b.broken += 1;
    else if (agent.health.label === 'needs_repair' || agent.health.label === 'watch') b.degraded += 1;
  }

  const labels: Record<SystemArea, string> = {
    admin: 'Admin',
    quotes: 'Quotes',
    crew: 'Crew',
    customer: 'Customer',
    public: 'Public site',
    ndis: 'NDIS',
  };

  return Array.from(buckets.entries()).map(([area, stat]) => {
    let state: GlobalTruthState;
    if (stat.broken > 0) state = 'blocked';
    else if (stat.degraded > 0) state = 'degraded';
    else state = 'healthy';
    return {
      area,
      label: labels[area],
      state,
      detail: stat.total === 0
        ? 'No agents tracked here.'
        : `${stat.total} agent${stat.total === 1 ? '' : 's'} · ${stat.broken} broken · ${stat.degraded} watch`,
    };
  });
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                          PROACTIVE FORECASTS                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type Forecast = {
  id: string;
  title: string;
  reason: string;
  horizon: 'next hour' | 'today' | 'this week';
  confidence: 'low' | 'medium' | 'high';
};

export function deriveForecasts(args: {
  commandState: MissionControlHealth;
  failures: StructuredFailure[];
  risk: OpRiskVector[];
}): Forecast[] {
  const out: Forecast[] = [];
  const conversion = args.risk.find((r) => r.key === 'conversion');
  if (conversion && conversion.level !== 'low') {
    out.push({
      id: 'forecast-conversion',
      title: 'Quote-to-booking conversion likely to dip this weekend',
      reason: 'Failures in the quote/booking path are accumulating faster than they are clearing.',
      horizon: 'this week',
      confidence: conversion.level === 'high' ? 'medium' : 'low',
    });
  }
  const deployment = args.risk.find((r) => r.key === 'deployment');
  if (deployment && deployment.level !== 'low') {
    out.push({
      id: 'forecast-deployment',
      title: 'Next deploy may stall on verification gates',
      reason: 'Previous deploy verification failed or is stale.',
      horizon: 'today',
      confidence: 'medium',
    });
  }
  if (args.commandState.counts.parse_failures > 0) {
    out.push({
      id: 'forecast-parse',
      title: 'Parse failures will trigger more retries within the hour',
      reason: `${args.commandState.counts.parse_failures} run${args.commandState.counts.parse_failures === 1 ? '' : 's'} returned unparsable output recently.`,
      horizon: 'next hour',
      confidence: 'high',
    });
  }
  const broken = args.commandState.counts.broken_agents;
  if (broken > 0) {
    out.push({
      id: 'forecast-cascading',
      title: 'Downstream tasks may queue while broken capabilities recover',
      reason: `${broken} capabilit${broken === 1 ? 'y is' : 'ies are'} blocked.`,
      horizon: 'today',
      confidence: 'medium',
    });
  }
  return out.slice(0, 3);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              PREFLIGHT VALIDATION                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type PreflightStatus = 'ready' | 'attention' | 'blocked';

export type PreflightCheck = {
  id: string;
  label: string;
  status: PreflightStatus;
  detail: string;
};

export function derivePreflight(args: {
  commandState: MissionControlHealth;
  incident: CanonicalIncident | null;
}): { overall: PreflightStatus; checks: PreflightCheck[] } {
  const checks: PreflightCheck[] = [];
  const incident = args.incident;
  const classified = incident?.signals[0] ? classifyIntent(incident.signals[0]) : null;

  checks.push({
    id: 'intent',
    label: 'Intent classified',
    status: !classified
      ? 'blocked'
      : classified.shouldTriggerRepair
        ? 'ready'
        : 'attention',
    detail: !classified
      ? 'No incident selected.'
      : classified.shouldTriggerRepair
        ? 'Real runtime error — repair eligible.'
        : classified.reason,
  });

  checks.push({
    id: 'memory',
    label: 'Memory available',
    status: args.commandState.memory.connected ? 'ready' : 'attention',
    detail: args.commandState.memory.connected
      ? `${args.commandState.memory.recent_count} recent notes in memory.`
      : 'Memory layer not connected.',
  });

  checks.push({
    id: 'github',
    label: 'GitHub reachable',
    status: args.commandState.deployment.connected ? 'ready' : 'blocked',
    detail: args.commandState.deployment.connected
      ? 'Webhook channel active.'
      : 'No GitHub telemetry seen — repair cannot land.',
  });

  checks.push({
    id: 'deployment',
    label: 'Deployment surface clean',
    status: args.commandState.deployment.status === 'failed' ? 'blocked' : 'ready',
    detail: args.commandState.deployment.summary,
  });

  const worst: PreflightStatus = checks.some((c) => c.status === 'blocked')
    ? 'blocked'
    : checks.some((c) => c.status === 'attention')
      ? 'attention'
      : 'ready';

  return { overall: worst, checks };
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                       VERIFIED PRODUCTION OUTCOMES                         */
/* ────────────────────────────────────────────────────────────────────────── */

export type VerifiedOutcome = {
  id: string;
  agentName: string;
  metric: string;
  at: string;
  evidence: string;
};

export function deriveVerifiedOutcomes(args: {
  commandState: MissionControlHealth;
  activity: BudActivityEvent[];
}): VerifiedOutcome[] {
  const out: VerifiedOutcome[] = [];
  for (const session of args.commandState.repair_sessions) {
    if (session.phase !== 'recovered' && session.phase !== 'learned') continue;
    out.push({
      id: session.id,
      agentName: session.agent_name,
      metric: session.description.length > 80 ? session.description.slice(0, 80) + '…' : session.description,
      at: session.created_at,
      evidence: session.linked_deployment
        ? 'Deployment + memory note recorded.'
        : session.linked_memory_note
          ? 'Memory note captured.'
          : 'Repair phase resolved.',
    });
  }
  // Optionally include explicit completion activity events.
  for (const ev of args.activity) {
    if (ev.event_type !== 'completion' || out.find((o) => o.id === ev.id)) continue;
    out.push({
      id: ev.id,
      agentName: ev.actor ?? 'Bud',
      metric: ev.narrative,
      at: ev.created_at,
      evidence: 'Logged completion event.',
    });
  }
  return out.slice(0, 4);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                              LIVE CUSTOMER IMPACT                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type CustomerImpactSignal = {
  id: string;
  surface: string;
  signal: string;
  severity: OpRiskLevel;
};

export function deriveCustomerImpact(args: {
  failures: StructuredFailure[];
  uxEvolution: UxEvolutionRecommendation[];
  commandState: MissionControlHealth;
}): CustomerImpactSignal[] {
  const out: CustomerImpactSignal[] = [];
  for (const f of args.failures) {
    if (!/quote|booking|customer|map|geo|checkout|stripe/i.test(`${f.agentName} ${f.message}`)) continue;
    out.push({
      id: `impact-${f.runId}`,
      surface: capitalise(f.agentName),
      signal: humanImpactFor(f),
      severity: f.severity === 'critical' ? 'critical' : f.severity === 'high' ? 'high' : 'medium',
    });
  }
  for (const u of args.uxEvolution.slice(0, 2)) {
    if (u.severity !== 'critical' && u.severity !== 'high') continue;
    out.push({
      id: `impact-ux-${u.id}`,
      surface: u.affected_area ?? 'UX',
      signal: u.title,
      severity: u.severity === 'critical' ? 'critical' : 'high',
    });
  }
  return out.slice(0, 4);
}

function humanImpactFor(f: StructuredFailure): string {
  if (/timeout/i.test(f.errorType)) return `Users may see ${f.agentName} stall before responding.`;
  if (/parse|schema/i.test(f.errorType)) return `${f.agentName} produced unusable output — flow may have stalled silently.`;
  if (/permission|forbidden/i.test(f.errorType)) return `${f.agentName} could not access its data — feature unavailable.`;
  if (/network|fetch/i.test(f.errorType)) return `${f.agentName} could not reach an upstream service — likely partial outage.`;
  return `${f.agentName} failure — investigate likely user impact.`;
}
