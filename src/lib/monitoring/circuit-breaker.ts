/**
 * Per-agent sliding-window circuit breaker with half-open recovery.
 *
 * States:
 *   CLOSED  – normal operation, failures are counted
 *   OPEN    – tripped; calls return fallback immediately
 *   HALF_OPEN – one probe call is allowed through to test recovery
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of failures in the window that trips the breaker. Default: 5 */
  tripThreshold?: number;
  /** Sliding window duration in milliseconds. Default: 60_000 (1 min) */
  windowMs?: number;
  /** How long to wait in OPEN state before moving to HALF_OPEN. Default: 30_000 */
  recoveryMs?: number;
  /** Optional webhook URL to POST an alert when the breaker trips. */
  alertWebhookUrl?: string;
}

interface FailureRecord {
  ts: number;
}

interface BreakerEntry {
  state: CircuitState;
  failures: FailureRecord[];
  openedAt: number | null;
}

const DEFAULT_TRIP_THRESHOLD = 5;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_RECOVERY_MS = 30_000;

/**
 * Singleton registry of per-agent circuit breaker state.
 * Exported as a class so tests can instantiate isolated instances.
 */
export class CircuitBreakerRegistry {
  private readonly tripThreshold: number;
  private readonly windowMs: number;
  private readonly recoveryMs: number;
  private readonly alertWebhookUrl: string | undefined;
  private readonly breakers = new Map<string, BreakerEntry>();

  constructor(options: CircuitBreakerOptions = {}) {
    this.tripThreshold = options.tripThreshold ?? DEFAULT_TRIP_THRESHOLD;
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.recoveryMs = options.recoveryMs ?? DEFAULT_RECOVERY_MS;
    this.alertWebhookUrl = options.alertWebhookUrl;
  }

  private getOrCreate(agentId: string): BreakerEntry {
    if (!this.breakers.has(agentId)) {
      this.breakers.set(agentId, { state: 'CLOSED', failures: [], openedAt: null });
    }
    return this.breakers.get(agentId)!;
  }

  private pruneWindow(entry: BreakerEntry, now: number): void {
    const cutoff = now - this.windowMs;
    entry.failures = entry.failures.filter((f) => f.ts > cutoff);
  }

  /** Returns the current state for an agent, advancing OPEN→HALF_OPEN if recovery time has elapsed. */
  getState(agentId: string): CircuitState {
    const entry = this.getOrCreate(agentId);
    const now = Date.now();
    if (entry.state === 'OPEN' && entry.openedAt !== null) {
      if (now - entry.openedAt >= this.recoveryMs) {
        entry.state = 'HALF_OPEN';
      }
    }
    return entry.state;
  }

  /**
   * Returns true if the call should be BLOCKED (breaker is OPEN).
   * HALF_OPEN allows one probe through (returns false).
   */
  isOpen(agentId: string): boolean {
    return this.getState(agentId) === 'OPEN';
  }

  /** Record a successful call — resets the breaker to CLOSED. */
  recordSuccess(agentId: string): void {
    const entry = this.getOrCreate(agentId);
    entry.state = 'CLOSED';
    entry.failures = [];
    entry.openedAt = null;
  }

  /** Record a failed call — may trip the breaker and dispatch a webhook alert. */
  async recordFailure(agentId: string): Promise<void> {
    const entry = this.getOrCreate(agentId);
    const now = Date.now();

    // HALF_OPEN probe failed → go back to OPEN
    if (entry.state === 'HALF_OPEN') {
      entry.state = 'OPEN';
      entry.openedAt = now;
      return;
    }

    if (entry.state === 'OPEN') {
      // Already open, nothing more to do
      return;
    }

    // CLOSED — record failure
    this.pruneWindow(entry, now);
    entry.failures.push({ ts: now });

    if (entry.failures.length >= this.tripThreshold) {
      entry.state = 'OPEN';
      entry.openedAt = now;
      await this.dispatchAlert(agentId, entry.failures.length);
    }
  }

  private async dispatchAlert(agentId: string, failureCount: number): Promise<void> {
    if (!this.alertWebhookUrl) return;
    try {
      await fetch(this.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Circuit breaker OPEN for agent \`${agentId}\` after ${failureCount} failures in the last ${this.windowMs / 1000}s window.`,
          agentId,
          failureCount,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // Never let alerting failure propagate
    }
  }

  /** Resets all state — useful for testing. */
  reset(agentId?: string): void {
    if (agentId) {
      this.breakers.delete(agentId);
    } else {
      this.breakers.clear();
    }
  }
}

/** Shared singleton used by agent-runner. */
export const circuitBreakerRegistry = new CircuitBreakerRegistry({
  alertWebhookUrl: process.env.AGENT_ALERT_WEBHOOK_URL,
});
