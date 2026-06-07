/**
 * agent-metrics.ts
 *
 * Composable utility for recording agent run outcomes and detecting
 * empty/null output payloads. Deliberately avoids importing from
 * agent-runner.ts or agent-executor.ts (both have documented CI instability).
 *
 * Orchestrators can call recordAgentRun() surgically at their own output
 * boundary without any coupling to runner internals.
 */

// ─── Metric counter names ──────────────────────────────────────────────────
export const METRIC_AGENT_RUN_SUCCESS = 'agent.run.success' as const;
export const METRIC_AGENT_RUN_FAILURE = 'agent.run.failure' as const;
export const METRIC_AGENT_RUN_EMPTY_OUTPUT = 'agent.run.empty_output' as const;

export type AgentRunMetric =
  | typeof METRIC_AGENT_RUN_SUCCESS
  | typeof METRIC_AGENT_RUN_FAILURE
  | typeof METRIC_AGENT_RUN_EMPTY_OUTPUT;

// ─── Tag shape ────────────────────────────────────────────────────────────
export interface MetricTags {
  agent_name: string;
  [key: string]: string;
}

// ─── Metrics backend abstraction ──────────────────────────────────────────
export interface MetricsBackend {
  increment(metric: string, tags: MetricTags): void;
}

/** Console-based fallback — always available, zero external dependencies. */
const consoleBackend: MetricsBackend = {
  increment(metric, tags) {
    console.log(
      JSON.stringify({
        level: 'metric',
        metric,
        tags,
        ts: new Date().toISOString(),
      }),
    );
  },
};

// Replaceable at runtime (e.g. swap in a StatsD/Datadog backend in production).
let _backend: MetricsBackend = consoleBackend;

export function setMetricsBackend(backend: MetricsBackend): void {
  _backend = backend;
}

export function getMetricsBackend(): MetricsBackend {
  return _backend;
}

// ─── Output emptiness check ───────────────────────────────────────────────

/**
 * Returns true when the agent's output payload is considered empty:
 *   - null or undefined
 *   - an empty string (or whitespace-only string)
 *   - an array with zero elements
 *   - an object with no own enumerable keys
 */
export function isEmptyOutput(output: unknown): boolean {
  if (output === null || output === undefined) return true;
  if (typeof output === 'string') return output.trim().length === 0;
  if (Array.isArray(output)) return output.length === 0;
  if (typeof output === 'object') return Object.keys(output as Record<string, unknown>).length === 0;
  return false;
}

// ─── Agent run record ─────────────────────────────────────────────────────

export interface AgentRunInput {
  /** Logical name of the agent (e.g. 'quote-triage', 'bud-observer'). */
  agent_name: string;
  /** Whether the run completed without an unhandled exception. */
  succeeded: boolean;
  /** The output value produced by the agent (may be null/undefined). */
  output: unknown;
  /** Optional extra tags forwarded to the metrics backend. */
  extra_tags?: Record<string, string>;
}

export interface AgentRunRecord {
  agent_name: string;
  succeeded: boolean;
  is_empty_output: boolean;
  metrics_emitted: AgentRunMetric[];
}

/**
 * Record a single agent run outcome.
 *
 * Detects empty outputs, sets `is_empty_output`, and emits tagged counters:
 *   - agent.run.success      (when succeeded === true)
 *   - agent.run.failure      (when succeeded === false)
 *   - agent.run.empty_output (when output is null / empty / zero-length)
 *
 * Returns a record describing what was detected and emitted so callers can
 * log or assert on it without re-running the detection logic.
 */
export function recordAgentRun(input: AgentRunInput): AgentRunRecord {
  const { agent_name, succeeded, output, extra_tags = {} } = input;

  const is_empty_output = isEmptyOutput(output);
  const tags: MetricTags = { agent_name, ...extra_tags };
  const backend = getMetricsBackend();
  const emitted: AgentRunMetric[] = [];

  if (succeeded) {
    backend.increment(METRIC_AGENT_RUN_SUCCESS, tags);
    emitted.push(METRIC_AGENT_RUN_SUCCESS);
  } else {
    backend.increment(METRIC_AGENT_RUN_FAILURE, tags);
    emitted.push(METRIC_AGENT_RUN_FAILURE);
  }

  if (is_empty_output) {
    backend.increment(METRIC_AGENT_RUN_EMPTY_OUTPUT, tags);
    emitted.push(METRIC_AGENT_RUN_EMPTY_OUTPUT);
  }

  return { agent_name, succeeded, is_empty_output, metrics_emitted: emitted };
}
