import { z } from 'zod';
import { withOutputGuard } from './withOutputGuard';

/**
 * Descriptor passed to runAgent describing the agent being invoked.
 */
export interface AgentDescriptor<TInput, TOutput> {
  /** Human-readable name used in error messages and logs. */
  name: string;
  /**
   * Zod schema that the output must satisfy.
   * Pass `null` to skip schema validation while still enforcing non-null / non-empty.
   */
  outputSchema: z.ZodType<TOutput> | null;
  /** The agent's core logic. */
  run: (input: TInput) => Promise<TOutput>;
}

/**
 * Canonical base runner for all agents.
 *
 * Automatically wires withOutputGuard so every invocation inherits:
 *   - null/undefined output rejection
 *   - empty-object output rejection
 *   - Zod output-schema validation
 *
 * Usage:
 * ```ts
 * const result = await runAgent({
 *   name: 'my-agent',
 *   outputSchema: MyOutputSchema,
 *   run: async (input) => { ... },
 * }, input);
 * ```
 */
export async function runAgent<TInput, TOutput>(
  descriptor: AgentDescriptor<TInput, TOutput>,
  input: TInput,
): Promise<TOutput> {
  const guarded = withOutputGuard(
    descriptor.name,
    descriptor.outputSchema,
    descriptor.run,
  );
  return guarded(input);
}
