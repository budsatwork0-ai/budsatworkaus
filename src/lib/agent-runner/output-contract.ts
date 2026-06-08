/**
 * output-contract.ts
 *
 * Shared circuit-breaker that prevents silent agent completion by
 * reclassifying null / undefined / empty-object outputs as a
 * distinct `failed_no_output` run status.
 *
 * This module is intentionally self-contained (no runner imports)
 * so it can be shipped and type-checked before the runner source
 * is available in context.
 */

// ─── Run-status extension ────────────────────────────────────────────────────

/** The canonical status value written to the DB when an agent produces no output. */
export const FAILED_NO_OUTPUT = 'failed_no_output' as const;
export type FailedNoOutput = typeof FAILED_NO_OUTPUT;

// ─── Error class ─────────────────────────────────────────────────────────────

/**
 * Thrown by `enforceOutputContract` when an agent finishes without
 * producing a meaningful output object.
 */
export class AgentOutputError extends Error {
  readonly status: FailedNoOutput = FAILED_NO_OUTPUT;

  constructor(agentId: string, received: unknown) {
    super(
      `Agent "${agentId}" completed without producing output. ` +
        `Received: ${JSON.stringify(received)}`
    );
    this.name = 'AgentOutputError';
    // Maintains proper prototype chain in transpiled ES5 targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Contract predicate ───────────────────────────────────────────────────────

/**
 * Returns `true` when `value` should be considered "no output":
 *   - `null`
 *   - `undefined`
 *   - a plain object with zero own enumerable keys `{}`
 */
export function isEmptyOutput(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
  ) {
    return true;
  }
  return false;
}

// ─── Post-run hook ────────────────────────────────────────────────────────────

/**
 * Post-run hook to be called after every agent execution.
 *
 * If `output` passes the empty-output check the function throws an
 * `AgentOutputError`, which the runner should catch and record with
 * `status = FAILED_NO_OUTPUT` instead of a generic failure.
 *
 * Usage (once the runner source is available):
 * ```ts
 * const output = await runAgent(agent, input);
 * enforceOutputContract(agent.id, output); // throws if empty
 * await saveRun({ status: 'completed', output });
 * ```
 *
 * @param agentId  Human-readable agent identifier for the error message.
 * @param output   The raw value returned by the agent executor.
 * @throws {AgentOutputError} when `output` is null, undefined, or `{}`.
 */
export function enforceOutputContract(agentId: string, output: unknown): void {
  if (isEmptyOutput(output)) {
    throw new AgentOutputError(agentId, output);
  }
}
