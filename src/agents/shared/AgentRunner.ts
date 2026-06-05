import type { ZodIssue } from 'zod';
import type { Agent } from './agent-types';

// ─── Error types ──────────────────────────────────────────────────────────────

export class AgentOutputValidationError extends Error {
  public readonly issues: ZodIssue[];
  public readonly agentName: string;

  constructor(agentName: string, issues: ZodIssue[]) {
    super(
      `[AgentRunner] Output validation failed for agent "${agentName}": ${issues
        .map((i) => `${i.path.join('.')} — ${i.message}`)
        .join('; ')}`,
    );
    this.name = 'AgentOutputValidationError';
    this.agentName = agentName;
    this.issues = issues;
    // Maintain proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Runner ───────────────────────────────────────────────────────────────────

export class AgentRunner {
  /**
   * Runs an agent and optionally validates its output against `agent.outputSchema`.
   *
   * - Agents without an `outputSchema` behave exactly as before (backward-compatible).
   * - Agents with an `outputSchema` will have their output parsed via `safeParse`.
   *   If parsing fails, `AgentOutputValidationError` is thrown so the run is
   *   recorded as failed rather than silently succeeding with bad data.
   */
  static async run<TInput, TOutput>(
    agent: Agent<TInput, TOutput>,
    input: TInput,
  ): Promise<TOutput> {
    const output = await agent.run(input);

    if (agent.outputSchema) {
      const result = agent.outputSchema.safeParse(output);
      if (!result.success) {
        throw new AgentOutputValidationError(agent.name, result.error.issues);
      }
    }

    return output;
  }
}
