import { circuitBreakerRegistry } from '@/lib/monitoring/circuit-breaker';

/**
 * Safe fallback payload returned when an agent's circuit breaker is open.
 */
const CIRCUIT_OPEN_FALLBACK = {
  success: false,
  circuitOpen: true,
  result: null,
  error: 'Agent is temporarily unavailable — circuit breaker is open.',
} as const;

export type AgentPayload = Record<string, unknown>;

export interface RunAgentOptions {
  agentId: string;
  run: () => Promise<AgentPayload>;
}

/**
 * Runs an agent function with circuit-breaker protection.
 *
 * - If the breaker is OPEN  → returns CIRCUIT_OPEN_FALLBACK immediately.
 * - If the call succeeds   → records success (resets HALF_OPEN → CLOSED).
 * - If the call throws     → records failure (may trip breaker) and re-throws.
 */
export async function runAgent({ agentId, run }: RunAgentOptions): Promise<AgentPayload> {
  if (circuitBreakerRegistry.isOpen(agentId)) {
    return { ...CIRCUIT_OPEN_FALLBACK };
  }

  try {
    const result = await run();
    circuitBreakerRegistry.recordSuccess(agentId);
    return result;
  } catch (err) {
    await circuitBreakerRegistry.recordFailure(agentId);
    throw err;
  }
}
