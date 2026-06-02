/**
 * Reusable CircuitBreaker utility.
 *
 * States:
 *   CLOSED  – normal operation, requests pass through.
 *   OPEN    – too many consecutive failures; requests are short-circuited.
 *   HALF_OPEN – one probe request is allowed to test recovery.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before the circuit opens. Default: 5 */
  failureThreshold?: number;
  /** Milliseconds to wait before moving OPEN → HALF_OPEN. Default: 60_000 */
  recoveryTimeoutMs?: number;
  /** Human-readable name for logging. */
  name: string;
}

export interface CircuitOpenResult {
  ok: false;
  circuitOpen: true;
  message: string;
}

export interface CircuitSuccessResult<T> {
  ok: true;
  circuitOpen: false;
  value: T;
}

export type CircuitResult<T> = CircuitSuccessResult<T> | CircuitOpenResult;

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 60_000;
  }

  getState(): CircuitState {
    return this.state;
  }

  /** Execute fn through the circuit breaker. */
  async run<T>(fn: () => Promise<T>): Promise<CircuitResult<T>> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'OPEN') {
      this.logOpen();
      return {
        ok: false,
        circuitOpen: true,
        message:
          'Quote received — our team will follow up manually.',
      };
    }

    try {
      const value = await fn();
      this.onSuccess();
      return { ok: true, circuitOpen: false, value };
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'OPEN' &&
      this.openedAt !== null &&
      Date.now() - this.openedAt >= this.recoveryTimeoutMs
    ) {
      this.state = 'HALF_OPEN';
      console.info(
        `[CircuitBreaker:${this.name}] state → HALF_OPEN (probing after recovery timeout)`
      );
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.info(
        `[CircuitBreaker:${this.name}] probe succeeded — state → CLOSED`
      );
    }
    this.state = 'CLOSED';
    this.consecutiveFailures = 0;
    this.openedAt = null;
  }

  private onFailure(err: unknown): void {
    this.consecutiveFailures += 1;
    console.error(
      `[CircuitBreaker:${this.name}] failure #${this.consecutiveFailures}`,
      err
    );

    if (
      this.state === 'HALF_OPEN' ||
      this.consecutiveFailures >= this.failureThreshold
    ) {
      this.state = 'OPEN';
      this.openedAt = Date.now();
      console.error(
        `[CircuitBreaker:${this.name}] state → OPEN after ${
          this.consecutiveFailures
        } consecutive failures`
      );
    }
  }

  private logOpen(): void {
    console.error(
      `[CircuitBreaker:${this.name}] circuit is OPEN — returning degraded response`,
      {
        consecutiveFailures: this.consecutiveFailures,
        openedAt: this.openedAt,
        recoveryTimeoutMs: this.recoveryTimeoutMs,
      }
    );
  }
}
