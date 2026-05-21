/**
 * Structured Failure Intelligence
 *
 * Replace vague "Unexpected error - no structured failure reason captured"
 * messages with rich diagnostic objects Bud can actually reason over.
 */

export type StructuredFailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export type StructuredFailure = {
  agentId: string | null;
  agentName: string;
  severity: StructuredFailureSeverity;
  runId: string;
  errorType: string;
  failedStep: string;
  message: string;
  stack: string | null;
  rawLogs: string;
  suspectedCause: string;
  recommendedFix: string;
  affectedFiles: string[];
  confidenceScore: number;
  needsApproval: boolean;
  createdAt: string;
};

type RunLike = {
  id: string;
  agent_id?: string | null;
  status: string;
  summary: string | null;
  error?: string | null;
  output?: Record<string, unknown> | null;
  started_at: string;
};

const PARSE_PATTERNS = [
  /could not parse/i,
  /failed to parse/i,
  /json parse error/i,
  /unexpected token/i,
  /malformed/i,
];

const TIMEOUT_PATTERNS = [/timed?\s?out/i, /timeout/i, /deadline exceeded/i];
const PERMISSION_PATTERNS = [/permission denied/i, /unauthorized/i, /forbidden/i, /rls/i];
const NETWORK_PATTERNS = [/fetch failed/i, /econnrefused/i, /network/i, /dns/i];
const QUOTA_PATTERNS = [/rate limit/i, /quota/i, /429/];
const SCHEMA_PATTERNS = [/schema/i, /zod/i, /validation/i];

function classify(summary: string): { errorType: string; severity: StructuredFailureSeverity; suspected: string; recommended: string } {
  const text = summary;
  if (PARSE_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'PARSE_FAILURE',
      severity: 'high',
      suspected: 'Model returned text that did not conform to the agent output schema.',
      recommended: 'Tighten the system prompt JSON contract or add a repair pass that re-prompts on parse failure.',
    };
  }
  if (TIMEOUT_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'TIMEOUT',
      severity: 'medium',
      suspected: 'Underlying call exceeded the configured deadline.',
      recommended: 'Reduce work-per-run, increase timeout in the agent runner, or shard the task.',
    };
  }
  if (PERMISSION_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'PERMISSION_DENIED',
      severity: 'critical',
      suspected: 'Service role key, Supabase RLS, or third-party auth rejected the call.',
      recommended: 'Confirm credentials are loaded and the row-level policy permits this agent.',
    };
  }
  if (QUOTA_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'QUOTA_EXCEEDED',
      severity: 'high',
      suspected: 'External API quota or rate limit was exceeded.',
      recommended: 'Add backoff, cache responses, or reduce schedule frequency.',
    };
  }
  if (NETWORK_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'NETWORK_ERROR',
      severity: 'medium',
      suspected: 'Network transport failed - DNS, connection refused, or unreachable host.',
      recommended: 'Add retry with backoff and surface the upstream host in the failure record.',
    };
  }
  if (SCHEMA_PATTERNS.some((re) => re.test(text))) {
    return {
      errorType: 'SCHEMA_VIOLATION',
      severity: 'high',
      suspected: 'Output failed Zod / schema validation after generation.',
      recommended: 'Inspect the schema and the model output; loosen optional fields or add a normalization step.',
    };
  }
  return {
    errorType: 'UNCLASSIFIED',
    severity: 'medium',
    suspected: 'The failure has not been classified yet. Bud should investigate the raw logs.',
    recommended: 'Open a Bud investigation to capture a structured failure reason.',
  };
}

function extractStack(summary: string | null, output: Record<string, unknown> | null | undefined): string | null {
  if (output && typeof output === 'object') {
    const stack = (output as { stack?: unknown }).stack;
    if (typeof stack === 'string' && stack.length > 0) return stack;
  }
  if (!summary) return null;
  const matchAtLine = summary.match(/at .+:\d+:\d+/);
  return matchAtLine ? matchAtLine[0] : null;
}

function extractAffectedFiles(summary: string | null, output: Record<string, unknown> | null | undefined): string[] {
  const text = `${summary ?? ''}\n${JSON.stringify(output ?? {})}`;
  const matches = Array.from(text.matchAll(/[\w./-]+\.(?:ts|tsx|js|jsx|sql|md)/g));
  return Array.from(new Set(matches.map((m) => m[0]))).slice(0, 8);
}

function extractFailedStep(summary: string | null): string {
  if (!summary) return 'unknown';
  const stepMatch = summary.match(/step\s+["']?([\w_-]+)["']?/i);
  if (stepMatch) return stepMatch[1];
  if (/parse/i.test(summary)) return 'parse_output';
  if (/fetch/i.test(summary)) return 'fetch_external';
  if (/insert|update|select/i.test(summary)) return 'database_io';
  return 'agent_execution';
}

export function buildStructuredFailure(args: {
  run: RunLike;
  agentName: string;
}): StructuredFailure {
  const { run, agentName } = args;
  const summary = run.summary ?? run.error ?? '';
  const classification = classify(summary);
  const stack = extractStack(summary, run.output);
  const affectedFiles = extractAffectedFiles(summary, run.output);
  const failedStep = extractFailedStep(summary);

  // Confidence: do we know what this is?
  let confidence = 0.4;
  if (classification.errorType !== 'UNCLASSIFIED') confidence += 0.3;
  if (stack) confidence += 0.1;
  if (affectedFiles.length > 0) confidence += 0.1;
  if (summary.length > 80) confidence += 0.05;
  if (run.output && Object.keys(run.output).length > 0) confidence += 0.05;
  confidence = Math.min(0.99, confidence);

  return {
    agentId: run.agent_id ?? null,
    agentName,
    severity: classification.severity,
    runId: run.id,
    errorType: classification.errorType,
    failedStep,
    message: summary || 'Run failed with no captured message.',
    stack,
    rawLogs: summary,
    suspectedCause: classification.suspected,
    recommendedFix: classification.recommended,
    affectedFiles,
    confidenceScore: Math.round(confidence * 100) / 100,
    needsApproval: classification.severity === 'critical' || classification.errorType === 'PERMISSION_DENIED',
    createdAt: run.started_at,
  };
}

export function buildStructuredFailures(args: {
  runs: RunLike[];
  agentNameById: Map<string, string>;
}): StructuredFailure[] {
  return args.runs
    .filter((run) => run.status === 'failed' || run.status === 'needs_repair')
    .map((run) => buildStructuredFailure({
      run,
      agentName: run.agent_id ? args.agentNameById.get(run.agent_id) ?? run.agent_id : 'Unknown agent',
    }));
}
