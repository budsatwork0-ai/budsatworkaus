import type { ZodTypeAny } from 'zod';

/**
 * Base interface for all agents in the fleet.
 * `outputSchema` is optional — agents without it are unaffected.
 */
export interface Agent<TInput = unknown, TOutput = unknown> {
  name: string;
  description?: string;
  run: (input: TInput) => Promise<TOutput>;
  /**
   * Optional Zod schema to validate the agent's output.
   * When present, AgentRunner will run safeParse after the agent resolves.
   * On failure it throws AgentOutputValidationError (recorded as a failed run).
   */
  outputSchema?: ZodTypeAny;
}
