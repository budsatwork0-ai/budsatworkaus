import { AgentOutputSchema } from './schemas';

type RunRow = {
  id: string;
  agent_id?: string;
  status: string;
  summary: string | null;
  output?: Record<string, unknown> | null;
  started_at: string;
};

type ActionRow = {
  id: string;
  agent_id?: string | null;
  status: string;
};

type AgentRow = {
  id: string;
  name?: string | null;
  category?: string | null;
  autonomy?: string | null;
  status?: string | null;
};

type GithubEventRow = {
  id: string;
  event_type: string;
  action: string | null;
  repo?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: string | null;
  created_at: string;
};

type BudTaskRow = {
  id: string;
  source_agent: string | null;
  target_agent?: string | null;
  status: string;
  confidence: number | null;
  risk_level: string | null;
  description: string;
  autonomy_level: number | null;
  linked_issue: string | null;
  linked_pr: string | null;
  linked_deployment: string | null;
  linked_memory_note: string | null;
  created_at: string;
  updated_at?: string | null;
};

type ChangeRequestRow = {
  id: string;
  task_id: string | null;
  branch_name: string | null;
  issue_url: string | null;
  pr_url: string | null;
  deployment_url: string | null;
  status: string;
  created_at: string;
};

type InsightRow = {
  id: string;
  agent_id: string | null;
  category: string;
  severity: string;
  title: string;
  created_at: string;
};

type MemoryRow = {
  id: string;
  category: string;
  title: string;
  vault_path?: string | null;
  created_at: string;
};

export type AgentLifecycleState = 'active' | 'idle' | 'awaiting_review' | 'degraded' | 'blocked' | 'overloaded' | 'dormant' | 'retired';

export type MissionControlAgentState = {
  id: string;
  name: string;
  category: string;
  autonomy: string;
  configured_status: string;
  lifecycle: AgentLifecycleState;
  health: AgentHealthScore;
  runs_7d: number;
  successes_7d: number;
  failures_7d: number;
  pending_approvals: number;
  last_run_at: string | null;
  last_failure: string | null;
  recommended_action: string;
};

export type MissionControlRepairSession = {
  id: string;
  agent_id: string | null;
  agent_name: string;
  status: string;
  phase:
    | 'detected'
    | 'diagnosing'
    | 'reproducing'
    | 'analyzing'
    | 'planning'
    | 'awaiting_approval'
    | 'repairing'
    | 'patching'
    | 'validating'
    | 'deploying'
    | 'verifying'
    | 'monitoring'
    | 'recovered'
    | 'rolled_back'
    | 'learned'
    | 'blocked';
  risk_level: string;
  confidence: number | null;
  description: string;
  linked_issue: string | null;
  linked_pr: string | null;
  linked_deployment: string | null;
  linked_memory_note: string | null;
  created_at: string;
};

export type MissionControlDeploymentState = {
  connected: boolean;
  status: 'unknown' | 'healthy' | 'deploying' | 'failed' | 'stale';
  last_event_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  last_url: string | null;
  summary: string;
};

export type MissionControlCapability = {
  key: 'monitor' | 'diagnose' | 'repair' | 'approve' | 'deploy' | 'verify' | 'learn';
  label: string;
  status: 'online' | 'partial' | 'blocked';
  detail: string;
};

export type MissionControlHealth = GlobalHealthCheck & {
  command_name: 'Bud OS';
  operating_mode: 'monitoring' | 'diagnosing' | 'repairing' | 'waiting_for_approval' | 'verifying' | 'blocked';
  agents: MissionControlAgentState[];
  repair_sessions: MissionControlRepairSession[];
  deployment: MissionControlDeploymentState;
  capabilities: MissionControlCapability[];
  memory: {
    connected: boolean;
    recent_count: number;
    last_write_at: string | null;
    learning_ready: boolean;
  };
  approvals: {
    pending_agent_actions: number;
    pending_bud_approvals: number;
    total_pending: number;
  };
};

export type AgentHealthLabel = 'healthy' | 'watch' | 'needs_repair' | 'broken' | 'inactive';

export type AgentHealthScore = {
  score: number;
  label: AgentHealthLabel;
  reasons: string[];
  parse_valid: boolean;
  output_useful: boolean;
  repeated_failures: boolean;
};

export type OperationalStatus = 'nominal' | 'degraded' | 'attention_required' | 'repairing' | 'blocked';

export type GlobalStatus = 'nominal' | 'degraded' | 'attention_required' | 'repairing' | 'blocked';

export type GlobalHealthCheck = {
  status: OperationalStatus;
  global_status: GlobalStatus;
  bud_status: 'nominal' | 'elevated' | 'critical';
  counts: {
    failed_runs: number;
    broken_agents: number;
    needs_repair_agents: number;
    watch_agents: number;
    pending_approvals: number;
    parse_failures: number;
    unresolved_alerts: number;
    low_success_rate_agents: number;
    blocked_repairs: number;
  };
  agents_needing_attention: string[];
  summary: string;
  is_nominal: boolean;
};

const NOISE_PHRASES = [
  'logged 0', 'found 0', '0 results', '0 findings', 'no findings', 'no results',
  'nothing found', 'no new', 'no items', 'no changes', 'no data', 'no records',
  '0 issues', '0 records', '0 items', '0 alerts', '0 matches',
  'completed with no', 'ran successfully with no', 'nothing to report',
  'no recent completed', 'proposed 0', 'checked 0', 'wrote 0', 'sent 0',
];

function isUsefulSummary(summary: string | null): boolean {
  if (!summary || summary.trim().length < 15) return false;
  const s = summary.toLowerCase();
  return !NOISE_PHRASES.some((p) => s.includes(p));
}

export function hasParseFailure(run: RunRow): boolean {
  const s = (run.summary ?? '').toLowerCase();
  return (
    s.includes('could not parse') ||
    s.includes('failed to parse') ||
    s.includes('json parse error') ||
    s.includes('unexpected token') ||
    s.includes('malformed') ||
    run.status === 'needs_repair'
  );
}

function isWatchStatus(status: string | null | undefined): boolean {
  return ['watch', 'awaiting_review', 'needs_approval', 'pending_approval'].includes((status ?? '').toLowerCase());
}

function isNeedsRepairStatus(status: string | null | undefined): boolean {
  return ['needs_repair', 'repair', 'failed_needs_repair'].includes((status ?? '').toLowerCase());
}

function isBrokenStatus(status: string | null | undefined): boolean {
  return ['broken', 'failed', 'error', 'critical'].includes((status ?? '').toLowerCase());
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string | null {
  if (count === 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatHealthCounts(counts: GlobalHealthCheck['counts']): string {
  const parts = [
    countLabel(counts.failed_runs, 'failed run'),
    countLabel(counts.broken_agents, 'broken agent'),
    countLabel(counts.needs_repair_agents, 'needs repair agent'),
    countLabel(counts.watch_agents, 'watch agent'),
    countLabel(counts.pending_approvals, 'pending approval'),
    countLabel(counts.parse_failures, 'parse failure'),
    countLabel(counts.unresolved_alerts, 'unresolved alert'),
    countLabel(counts.low_success_rate_agents, 'low success-rate agent'),
    countLabel(counts.blocked_repairs, 'blocked repair'),
  ].filter((p): p is string => Boolean(p));

  if (parts.length === 0) return 'no issues detected';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function evaluateGlobalHealth({
  agents,
  runs,
  actions,
  unresolvedAlerts = 0,
  blockedRepairs = 0,
  repairsInFlight = 0,
}: {
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  unresolvedAlerts?: number;
  blockedRepairs?: number;
  repairsInFlight?: number;
}): GlobalHealthCheck {
  const runsByAgent = new Map<string, RunRow[]>();
  for (const run of runs) {
    if (!run.agent_id) continue;
    const list = runsByAgent.get(run.agent_id) ?? [];
    list.push(run);
    runsByAgent.set(run.agent_id, list);
  }

  const pendingApprovals = actions.filter((a) => a.status === 'pending').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const parseFailures = runs.filter(hasParseFailure).length;

  let brokenAgents = 0;
  let needsRepairAgents = 0;
  let watchAgents = 0;
  let lowSuccessRateAgents = 0;
  const agentsNeedingAttention = new Set<string>();

  for (const agent of agents) {
    const health = scoreAgentHealth(runsByAgent.get(agent.id) ?? [], actions.filter((a) => a.agent_id === agent.id));
    const status = agent.status ?? '';

    const isBroken = health.label === 'broken' || isBrokenStatus(status);
    const isNeedsRepair = health.label === 'needs_repair' || isNeedsRepairStatus(status);
    const isWatch = health.label === 'watch' || isWatchStatus(status);

    if (isBroken) {
      brokenAgents++;
      agentsNeedingAttention.add(agent.id);
    } else if (isNeedsRepair) {
      needsRepairAgents++;
      agentsNeedingAttention.add(agent.id);
    } else if (isWatch) {
      watchAgents++;
      agentsNeedingAttention.add(agent.id);
    }

    if (health.score > 0 && health.score < 80) {
      lowSuccessRateAgents++;
      agentsNeedingAttention.add(agent.id);
    }
  }

  const counts = {
    failed_runs: failedRuns,
    broken_agents: brokenAgents,
    needs_repair_agents: needsRepairAgents,
    watch_agents: watchAgents,
    pending_approvals: pendingApprovals,
    parse_failures: parseFailures,
    unresolved_alerts: unresolvedAlerts,
    low_success_rate_agents: lowSuccessRateAgents,
    blocked_repairs: blockedRepairs,
  };

  // Strict nominal rules: ANY non-zero in the lists below means NOT nominal.
  const blockedIssue = counts.blocked_repairs > 0;
  const repairing = repairsInFlight > 0;

  const hasAttentionIssue =
    counts.failed_runs > 0 ||
    counts.broken_agents > 0 ||
    counts.needs_repair_agents > 0 ||
    counts.parse_failures > 0 ||
    counts.unresolved_alerts > 0;

  const hasDegradedIssue =
    counts.watch_agents > 0 ||
    counts.pending_approvals > 0 ||
    counts.low_success_rate_agents > 0;

  let globalStatus: GlobalStatus;
  if (blockedIssue) globalStatus = 'blocked';
  else if (hasAttentionIssue) globalStatus = 'attention_required';
  else if (repairing) globalStatus = 'repairing';
  else if (hasDegradedIssue) globalStatus = 'degraded';
  else globalStatus = 'nominal';

  // Legacy `status` field preserves the older trichotomy.
  const status: OperationalStatus =
    globalStatus === 'blocked' || globalStatus === 'attention_required' || globalStatus === 'repairing'
      ? 'attention_required'
      : globalStatus === 'degraded'
        ? 'degraded'
        : 'nominal';

  const isNominal = globalStatus === 'nominal';

  return {
    status,
    global_status: globalStatus,
    bud_status:
      globalStatus === 'blocked' || globalStatus === 'attention_required'
        ? 'critical'
        : globalStatus === 'repairing' || globalStatus === 'degraded'
          ? 'elevated'
          : 'nominal',
    counts,
    agents_needing_attention: Array.from(agentsNeedingAttention),
    summary: isNominal
      ? 'Operational review complete — system nominal.'
      : globalStatus === 'blocked'
        ? `Blocked: ${formatHealthCounts(counts)}.`
        : globalStatus === 'repairing'
          ? `Repair in flight while ${formatHealthCounts(counts)}.`
          : `Operational review complete — attention required. ${formatHealthCounts(counts)} detected.`,
    is_nominal: isNominal,
  };
}

function phaseForTask(task: BudTaskRow): MissionControlRepairSession['phase'] {
  if (task.status === 'reproducing') return 'reproducing';
  if (task.status === 'analyzing') return 'analyzing';
  if (task.status === 'planning') return 'planning';
  if (task.status === 'awaiting_approval') return 'awaiting_approval';
  if (task.status === 'patching') return 'patching';
  if (task.status === 'validating') return 'validating';
  if (task.status === 'deploying') return 'deploying';
  if (task.status === 'verifying') return 'verifying';
  if (task.status === 'monitoring') return 'monitoring';
  if (task.status === 'recovered') return 'recovered';
  if (task.status === 'rolled_back') return 'rolled_back';
  if (task.status === 'in_progress') return task.linked_pr || task.linked_deployment ? 'verifying' : 'repairing';
  if (task.status === 'completed') return task.linked_memory_note ? 'learned' : 'verifying';
  if (task.status === 'failed' || task.status === 'blocked') return 'blocked';
  return task.linked_issue ? 'diagnosing' : 'detected';
}

function lifecycleForAgent(
  agent: AgentRow,
  runs: RunRow[],
  health: AgentHealthScore,
  pendingApprovals: number,
): AgentLifecycleState {
  const status = (agent.status ?? '').toLowerCase();
  if (status === 'disabled') return 'retired';
  if (pendingApprovals > 0) return 'awaiting_review';
  const latest = runs[0];
  if (latest?.status === 'running') return 'active';
  if (latest?.status === 'needs_approval') return 'awaiting_review';
  if (latest?.status === 'needs_repair') return 'degraded';
  if (health.label === 'broken') return 'blocked';
  if (health.label === 'needs_repair' || health.label === 'watch') return 'degraded';
  if (!latest) return status === 'paused' ? 'dormant' : 'idle';
  const ageMs = Date.now() - new Date(latest.started_at).getTime();
  if (ageMs > 7 * 24 * 3600_000) return 'dormant';
  if (ageMs < 3600_000 && latest.status === 'succeeded') return 'active';
  return 'idle';
}

function recommendedActionForAgent(state: {
  lifecycle: AgentLifecycleState;
  health: AgentHealthScore;
  failures: number;
  pending: number;
}): string {
  if (state.lifecycle === 'awaiting_review') return `${state.pending} approval${state.pending === 1 ? '' : 's'} waiting for a human decision`;
  if (state.health.label === 'broken') return 'Start a Bud investigation and draft a repair task';
  if (state.health.label === 'needs_repair') return 'Review the latest failures and queue a targeted repair';
  if (!state.health.output_useful && state.health.label !== 'inactive') return 'Tune output so successful runs produce actionable intelligence';
  if (state.failures > 0) return 'Monitor the recent failure pattern before the next scheduled run';
  if (state.lifecycle === 'dormant') return 'Run manually or pause if this agent is no longer needed';
  return 'No action needed';
}

function computeDeploymentState(events: GithubEventRow[]): MissionControlDeploymentState {
  const deploymentEvents = events
    .filter((event) => event.event_type === 'deployment_status' || event.event_type === 'deployment_failure')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const latest = deploymentEvents[0] ?? null;
  const lastSuccess = deploymentEvents.find((event) => event.event_type === 'deployment_status' && event.action === 'success') ?? null;
  const lastFailure = deploymentEvents.find((event) => event.event_type === 'deployment_failure' || event.action === 'failure' || event.action === 'error') ?? null;
  const lastUrl = (latest?.metadata?.target_url ?? latest?.metadata?.deployment_url ?? latest?.metadata?.url ?? null) as string | null;

  if (!latest) {
    return {
      connected: false,
      status: 'unknown',
      last_event_at: null,
      last_success_at: null,
      last_failure_at: null,
      last_url: null,
      summary: 'No deployment telemetry is reaching Bud yet.',
    };
  }

  const ageMs = Date.now() - new Date(latest.created_at).getTime();
  const status: MissionControlDeploymentState['status'] =
    latest.event_type === 'deployment_failure' || latest.action === 'failure' || latest.action === 'error'
      ? 'failed'
      : latest.action === 'pending' || latest.action === 'in_progress'
        ? 'deploying'
        : ageMs > 14 * 24 * 3600_000
          ? 'stale'
          : 'healthy';

  return {
    connected: true,
    status,
    last_event_at: latest.created_at,
    last_success_at: lastSuccess?.created_at ?? null,
    last_failure_at: lastFailure?.created_at ?? null,
    last_url: lastUrl,
    summary: status === 'healthy'
      ? 'Latest deployment signal is healthy.'
      : status === 'failed'
        ? 'Latest deployment signal failed. Verification is required before declaring repairs complete.'
        : status === 'deploying'
          ? 'Deployment is currently in progress.'
          : 'Deployment telemetry is connected but stale.',
  };
}

function computeOperatingMode(args: {
  global: GlobalHealthCheck;
  repairSessions: MissionControlRepairSession[];
  pendingApprovals: number;
  deployment: MissionControlDeploymentState;
}): MissionControlHealth['operating_mode'] {
  if (args.deployment.status === 'failed') return 'blocked';
  if (args.pendingApprovals > 0 || args.repairSessions.some((s) => s.phase === 'awaiting_approval')) return 'waiting_for_approval';
  if (args.repairSessions.some((s) => s.phase === 'repairing')) return 'repairing';
  if (args.repairSessions.some((s) => s.phase === 'verifying')) return 'verifying';
  if (!args.global.is_nominal) return 'diagnosing';
  return 'monitoring';
}

export function computeMissionControlHealth({
  agents,
  runs,
  actions,
  budApprovals = [],
  tasks = [],
  changeRequests = [],
  github = [],
  insights = [],
  memory = [],
}: {
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  budApprovals?: ActionRow[];
  tasks?: BudTaskRow[];
  changeRequests?: ChangeRequestRow[];
  github?: GithubEventRow[];
  insights?: InsightRow[];
  memory?: MemoryRow[];
}): MissionControlHealth {
  const allApprovals = [...actions, ...budApprovals];

  // Pre-compute repair counts so strict nominal rules see them.
  const blockedRepairTasks = tasks.filter((t) => t.status === 'blocked' || t.status === 'failed').length;
  const repairsInFlight = tasks.filter((t) => [
    'patching',
    'validating',
    'deploying',
    'verifying',
    'in_progress',
  ].includes(t.status)).length;

  const global = evaluateGlobalHealth({
    agents,
    runs,
    actions: allApprovals,
    unresolvedAlerts: insights.length,
    blockedRepairs: blockedRepairTasks,
    repairsInFlight,
  });

  const runsByAgent = new Map<string, RunRow[]>();
  for (const run of runs) {
    if (!run.agent_id) continue;
    const list = runsByAgent.get(run.agent_id) ?? [];
    list.push(run);
    runsByAgent.set(run.agent_id, list);
  }

  const approvalsByAgent = new Map<string, number>();
  for (const action of allApprovals) {
    if (!action.agent_id || action.status !== 'pending') continue;
    approvalsByAgent.set(action.agent_id, (approvalsByAgent.get(action.agent_id) ?? 0) + 1);
  }

  const agentNameMap = new Map(agents.map((agent) => [agent.id, agent.name ?? agent.id]));
  const agentStates = agents.map((agent): MissionControlAgentState => {
    const agentRuns = runsByAgent.get(agent.id) ?? [];
    const health = scoreAgentHealth(agentRuns, allApprovals.filter((action) => action.agent_id === agent.id));
    const failures = agentRuns.filter((run) => run.status === 'failed' || run.status === 'needs_repair').length;
    const successes = agentRuns.filter((run) => run.status === 'succeeded').length;
    const pending = approvalsByAgent.get(agent.id) ?? 0;
    const lifecycle = lifecycleForAgent(agent, agentRuns, health, pending);
    const lastFailure = agentRuns.find((run) => run.status === 'failed' || run.status === 'needs_repair')?.summary ?? null;
    return {
      id: agent.id,
      name: agent.name ?? agent.id,
      category: agent.category ?? 'ops',
      autonomy: agent.autonomy ?? 'manual',
      configured_status: agent.status ?? 'unknown',
      lifecycle,
      health,
      runs_7d: agentRuns.length,
      successes_7d: successes,
      failures_7d: failures,
      pending_approvals: pending,
      last_run_at: agentRuns[0]?.started_at ?? null,
      last_failure: lastFailure,
      recommended_action: recommendedActionForAgent({ lifecycle, health, failures, pending }),
    };
  }).sort((a, b) => a.health.score - b.health.score);

  const crByTask = new Map(changeRequests.map((request) => [request.task_id, request]));
  const repairSessions = tasks.map((task): MissionControlRepairSession => {
    const cr = crByTask.get(task.id);
    return {
      id: task.id,
      agent_id: task.source_agent,
      agent_name: task.source_agent ? agentNameMap.get(task.source_agent) ?? task.source_agent : 'Bud',
      status: task.status,
      phase: phaseForTask(task),
      risk_level: task.risk_level ?? 'low',
      confidence: task.confidence,
      description: task.description,
      linked_issue: task.linked_issue ?? cr?.issue_url ?? null,
      linked_pr: task.linked_pr ?? cr?.pr_url ?? null,
      linked_deployment: task.linked_deployment ?? cr?.deployment_url ?? null,
      linked_memory_note: task.linked_memory_note,
      created_at: task.created_at,
    };
  });

  const deployment = computeDeploymentState(github);
  const lastMemory = memory[0] ?? null;
  const pendingBudApprovals = budApprovals.filter((approval) => approval.status === 'pending').length;
  const pendingAgentActions = actions.filter((action) => action.status === 'pending').length;
  const memoryState = {
    connected: memory.length > 0,
    recent_count: memory.length,
    last_write_at: lastMemory?.created_at ?? null,
    learning_ready: memory.length > 0 && repairSessions.some((session) => session.phase === 'learned' || session.linked_memory_note),
  };

  const capabilities: MissionControlCapability[] = [
    { key: 'monitor', label: 'Monitor', status: agents.length > 0 ? 'online' : 'blocked', detail: `${agents.length} agents registered` },
    { key: 'diagnose', label: 'Diagnose', status: runs.length > 0 ? 'online' : 'partial', detail: `${runs.length} recent run signals` },
    { key: 'repair', label: 'Repair', status: repairSessions.length > 0 ? 'online' : 'partial', detail: `${repairSessions.length} repair session${repairSessions.length === 1 ? '' : 's'}` },
    { key: 'approve', label: 'Approve', status: pendingAgentActions + pendingBudApprovals > 0 ? 'online' : 'partial', detail: `${pendingAgentActions + pendingBudApprovals} pending approvals` },
    { key: 'deploy', label: 'Deploy', status: deployment.connected ? (deployment.status === 'failed' ? 'blocked' : 'online') : 'blocked', detail: deployment.summary },
    { key: 'verify', label: 'Verify', status: deployment.connected ? 'online' : 'blocked', detail: deployment.last_success_at ? 'Deployment status webhook active' : 'No verified successful deployment yet' },
    { key: 'learn', label: 'Learn', status: memoryState.connected ? 'online' : 'blocked', detail: memoryState.connected ? `${memoryState.recent_count} recent memory records` : 'Memory vault not synced' },
  ];

  const operatingMode = computeOperatingMode({
    global,
    repairSessions,
    pendingApprovals: pendingAgentActions + pendingBudApprovals,
    deployment,
  });

  return {
    ...global,
    command_name: 'Bud OS',
    operating_mode: operatingMode,
    agents: agentStates,
    repair_sessions: repairSessions,
    deployment,
    capabilities,
    memory: memoryState,
    approvals: {
      pending_agent_actions: pendingAgentActions,
      pending_bud_approvals: pendingBudApprovals,
      total_pending: pendingAgentActions + pendingBudApprovals,
    },
    summary: global.is_nominal
      ? 'Bud OS is monitoring the workforce from one operational state engine.'
      : `Bud OS requires attention: ${formatHealthCounts(global.counts)}.`,
  };
}

function validateOutput(run: RunRow): boolean {
  if (!run.output) return false;
  const result = AgentOutputSchema.safeParse(run.output);
  return result.success;
}

export function scoreAgentHealth(
  runs: RunRow[],
  _actions: ActionRow[],
): AgentHealthScore {
  const reasons: string[] = [];

  if (runs.length === 0) {
    return {
      score: 0,
      label: 'inactive',
      reasons: ['No runs recorded'],
      parse_valid: true,
      output_useful: false,
      repeated_failures: false,
    };
  }

  const recentRuns = runs.slice(0, 10);
  const failedRuns = recentRuns.filter((r) => r.status === 'failed');
  const succeededRuns = recentRuns.filter((r) => r.status === 'succeeded');

  const parseFailures = recentRuns.filter(hasParseFailure);
  const parse_valid = parseFailures.length === 0;

  const validOutputRuns = succeededRuns.filter(validateOutput);
  const usefulSummaryRuns = succeededRuns.filter((r) => isUsefulSummary(r.summary));
  const output_useful = usefulSummaryRuns.length > 0 || validOutputRuns.length > 0;

  const repeated_failures = failedRuns.length >= 3;
  const failure_rate = failedRuns.length / recentRuns.length;

  // Scoring: start at 100, deduct
  let score = 100;

  if (!parse_valid) {
    score -= parseFailures.length * 15;
    reasons.push(`${parseFailures.length} parse failure(s) detected`);
  }

  if (!output_useful && succeededRuns.length > 0) {
    score -= 20;
    reasons.push('No actionable output from succeeded runs');
  }

  if (repeated_failures) {
    score -= 25;
    reasons.push(`${failedRuns.length} consecutive failures in last ${recentRuns.length} runs`);
  } else if (failure_rate > 0) {
    score -= Math.round(failure_rate * 30);
    if (failedRuns.length > 0) reasons.push(`${failedRuns.length} failure(s) in last ${recentRuns.length} runs`);
  }

  // Failed runs where no structured_failure_reason captured
  const unstructuredFailures = failedRuns.filter((r) => {
    if (!r.summary) return true;
    const s = r.summary.toLowerCase();
    return s.includes('unexpected error') && s.includes('no structured failure reason');
  });
  if (unstructuredFailures.length > 0) {
    score -= 10;
    reasons.push('Some failures lack structured failure reasons');
  }

  score = Math.max(0, Math.min(100, score));

  let label: AgentHealthLabel;
  if (!parse_valid || (score < 30 && !output_useful)) {
    label = 'broken';
  } else if (repeated_failures || score < 40) {
    label = 'broken';
  } else if (score < 60) {
    label = 'needs_repair';
  } else if (score < 80 || !output_useful) {
    label = 'watch';
  } else {
    label = 'healthy';
  }

  return { score, label, reasons, parse_valid, output_useful, repeated_failures };
}
