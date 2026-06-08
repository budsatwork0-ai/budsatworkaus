/**
 * Higher-order wrapper that adds output validation to any agent run function.
 *
 * Usage:
 *   import { withOutputValidation } from '@/lib/agents/shared/with-output-validation';
 *
 *   const safeRun = withOutputValidation('my-agent', originalRun);
 *   const result = await safeRun(input);
 *   // result is null when the inner fn returns null/empty output
 */

import { validateAgentOutput, type AgentOutput } from './output-validator';

export type AgentRunFn<TInput, TOutput extends AgentOutput> = (
  input: TInput
) => Promise<TOutput | null | undefined>;

/**
 * Wraps `fn` so that its return value is always passed through
 * `validateAgentOutput`. Returns `null` (and emits a warning) when the
 * wrapped function produces a null, undefined, or empty-content output.
 */
export function withOutputValidation<TInput, TOutput extends AgentOutput>(
  agentId: string,
  fn: AgentRunFn<TInput, TOutput>
): (input: TInput) => Promise<TOutput | null> {
  return async (input: TInput): Promise<TOutput | null> => {
    const output = await fn(input);
    if (!validateAgentOutput(agentId, output ?? null)) {
      return null;
    }
    return output as TOutput;
  };
}
