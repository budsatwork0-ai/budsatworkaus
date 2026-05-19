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
  status?: string | null;
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

export type OperationalStatus = 'nominal' | 'degraded' | 'attention_required';

export type GlobalHealthCheck = {
  status: OperationalStatus;
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
}: {
  agents: AgentRow[];
  runs: RunRow[];
  actions: ActionRow[];
  unresolvedAlerts?: number;
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
  };

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

  const status: OperationalStatus = hasAttentionIssue
    ? 'attention_required'
    : hasDegradedIssue
      ? 'degraded'
      : 'nominal';

  return {
    status,
    bud_status: status === 'attention_required' ? 'critical' : status === 'degraded' ? 'elevated' : 'nominal',
    counts,
    agents_needing_attention: Array.from(agentsNeedingAttention),
    summary: status === 'nominal'
      ? 'Operational review complete — system nominal.'
      : `Operational review complete — attention required. ${formatHealthCounts(counts)} detected.`,
    is_nominal: status === 'nominal',
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
