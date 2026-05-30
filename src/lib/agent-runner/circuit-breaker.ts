/**
 * CircuitBreaker – tracks open/closed/half-open state per agent.
 *
 * States:
 *  CLOSED   – normal operation, failures are counted.
 *  OPEN     – tripped after `failureThreshold` consecutive failures;
 *             calls are rejected immediately until `cooldownMs` elapses.
 *  HALF_OPEN – one probe attempt is allowed after cooldown; success
 *              resets to CLOSED, failure re-opens the circuit.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold?: number;
  /** Milliseconds to wait before transitioning OPEN → HALF_OPEN. */
  cooldownMs?: number;
}

interface CircuitEntry {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt: number | null;
}

const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000; // 1 minute

export class CircuitBreaker {
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly circuits = new Map<string, CircuitEntry>();

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  }

  private getEntry(agentName: string): CircuitEntry {
    if (!this.circuits.has(agentName)) {
      this.circuits.set(agentName, {
        state: 'CLOSED',
        consecutiveFailures: 0,
        openedAt: null,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.circuits.get(agentName)!;
  }

  /**
   * Returns the current (potentially transitioned) state for the agent.
   * Automatically transitions OPEN → HALF_OPEN once cooldown has elapsed.
   */
  getState(agentName: string): CircuitState {
    const entry = this.getEntry(agentName);

    if (
      entry.state === 'OPEN' &&
      entry.openedAt !== null &&
      Date.now() - entry.openedAt >= this.cooldownMs
    ) {
      entry.state = 'HALF_OPEN';
    }

    return entry.state;
  }

  /**
   * Call this when an agent invocation succeeds.
   * Resets the circuit to CLOSED.
   */
  recordSuccess(agentName: string): void {
    const entry = this.getEntry(agentName);
    entry.state = 'CLOSED';
    entry.consecutiveFailures = 0;
    entry.openedAt = null;
  }

  /**
   * Call this when an agent invocation fails.
   * In HALF_OPEN state a single failure immediately re-opens the circuit.
   * In CLOSED state, the circuit opens once `failureThreshold` is reached.
   */
  recordFailure(agentName: string): void {
    const entry = this.getEntry(agentName);

    if (entry.state === 'HALF_OPEN') {
      // Probe failed – re-open immediately.
      entry.state = 'OPEN';
      entry.openedAt = Date.now();
      entry.consecutiveFailures += 1;
      return;
    }

    entry.consecutiveFailures += 1;

    if (entry.consecutiveFailures >= this.failureThreshold) {
      entry.state = 'OPEN';
      entry.openedAt = Date.now();
    }
  }

  /**
   * Returns true when the circuit is open and calls should be rejected.
   * Handles the OPEN → HALF_OPEN cooldown transition transparently.
   */
  isOpen(agentName: string): boolean {
    const state = this.getState(agentName);
    return state === 'OPEN';
  }

  /** Exposed for testing / health-check endpoints. */
  getConsecutiveFailures(agentName: string): number {
    return this.getEntry(agentName).consecutiveFailures;
  }

  /** Forcibly reset a circuit (e.g. after a manual operator intervention). */
  reset(agentName: string): void {
    this.circuits.delete(agentName);
  }
}

/** Module-level singleton reused by the agent runner. */
export const globalCircuitBreaker = new CircuitBreaker();
