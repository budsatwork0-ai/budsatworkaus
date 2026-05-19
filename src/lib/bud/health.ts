import { AgentOutputSchema } from './schemas';

type RunRow = {
  id: string;
  status: string;
  summary: string | null;
  output?: Record<string, unknown> | null;
  started_at: string;
};

type ActionRow = {
  id: string;
  status: string;
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

function hasParseFailure(run: RunRow): boolean {
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
