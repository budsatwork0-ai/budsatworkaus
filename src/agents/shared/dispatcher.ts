import { AgentValidationError, validateAgentPayload } from './validation';
import { AgentType } from './schemas';

// ── Minimal monitoring hook ───────────────────────────────────────────────────
// The monitoring layer (health-check-runner / threshold-evaluator) is expected
// to expose this interface.  We use a dynamic import so the dispatcher remains
// usable even when the monitoring module is not yet present.
async function incrementFailureCount(agentType: string): Promise<void> {
  try {
    // Lazy-load to avoid hard coupling; falls back silently if unavailable.
    const mod = await import('@/lib/monitoring/health-check-runner').catch(
      () => null
    );
    if (mod && typeof mod.recordAgentFailure === 'function') {
      await mod.recordAgentFailure(agentType);
    }
  } catch {
    // Best-effort — never let monitoring errors surface to callers.
  }
}

// ── Agent handler registry ────────────────────────────────────────────────────
type AgentHandler<T> = (payload: T) => Promise<void>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<AgentType, AgentHandler<any>>();

export function registerAgentHandler<T extends AgentType>(
  agentType: T,
  handler: AgentHandler<unknown>
): void {
  registry.set(agentType, handler);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
/**
 * Central dispatch entry-point.  Validates the raw event payload against the
 * registered schema for `agentType` before forwarding to the handler.
 *
 * Validation failures throw `AgentValidationError` after incrementing the
 * monitoring failure counter so threshold evaluation can fire automatically.
 */
export async function dispatchAgentEvent(
  agentType: AgentType,
  rawPayload: unknown
): Promise<void> {
  // 1. Pre-dispatch validation gate
  let validatedPayload: unknown;
  try {
    validatedPayload = validateAgentPayload(agentType, rawPayload);
  } catch (err) {
    if (err instanceof AgentValidationError) {
      // Surface to monitoring before re-throwing
      await incrementFailureCount(agentType);
      throw err;
    }
    throw err;
  }

  // 2. Resolve handler
  const handler = registry.get(agentType);
  if (!handler) {
    throw new Error(`dispatchAgentEvent: no handler registered for "${agentType}"`);
  }

  // 3. Invoke handler with validated payload
  await handler(validatedPayload);
}
