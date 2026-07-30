import { z, ZodSchema } from 'zod';

/**
 * Registry mapping agent IDs to their declared output Zod schemas.
 *
 * Add an entry here whenever an agent gains a typed output contract.
 * Agents without an entry are skipped by the validation step (opt-in).
 */
const registry: Record<string, ZodSchema<unknown>> = {};

// ─── quote-triage (proof-of-concept) ─────────────────────────────────────────
// Minimal shape: the agent must return an object with at least a `status`
// string and an optional `reason` string.  Additional keys are allowed.
registry['quote-triage'] = z.object({
  status: z.string(),
  reason: z.string().optional(),
});

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the registered output schema for `agentId`, or `undefined` if
 * the agent has not yet opted in to runtime validation.
 */
export function getAgentOutputSchema(agentId: string): ZodSchema<unknown> | undefined {
  return registry[agentId];
}

/**
 * Returns true when `agentId` has a registered output schema.
 */
export function hasAgentOutputSchema(agentId: string): boolean {
  return agentId in registry;
}
