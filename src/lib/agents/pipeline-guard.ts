/**
 * pipeline-guard.ts
 * Lightweight null-guard utility for inter-agent pipeline boundaries.
 * Downstream agents (pricing, assignment, notification) call assertUpstreamOutput
 * at their entry points so silent upstream failures surface immediately.
 */

export function assertUpstreamOutput(
  output: unknown,
  upstreamAgentId: string,
  callerAgentId: string,
): asserts output is NonNullable<typeof output> {
  if (output === null || output === undefined) {
    throw new Error(
      `[pipeline-guard] ${callerAgentId} received null/undefined output from upstream agent "${upstreamAgentId}". ` +
        `The upstream agent may have failed silently. Halting pipeline to prevent data loss.`,
    );
  }

  if (typeof output === 'object' && !Array.isArray(output) && Object.keys(output as object).length === 0) {
    throw new Error(
      `[pipeline-guard] ${callerAgentId} received an empty-object output from upstream agent "${upstreamAgentId}". ` +
        `The upstream agent may have produced no results. Halting pipeline to prevent data loss.`,
    );
  }

  if (Array.isArray(output) && (output as unknown[]).length === 0) {
    throw new Error(
      `[pipeline-guard] ${callerAgentId} received an empty-array output from upstream agent "${upstreamAgentId}". ` +
        `The upstream agent produced no records. Halting pipeline to prevent data loss.`,
    );
  }
}
