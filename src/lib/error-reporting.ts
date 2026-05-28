import type { ZodIssue } from 'zod';

export interface ErrorEvent {
  /** Human-readable label identifying the origin of the error. */
  label: string;
  /** ISO-8601 timestamp produced at the call-site. */
  timestamp: string;
  /** Lightweight snapshot of the incoming payload shape. */
  inputShape?: Record<string, unknown>;
  /** Human-readable failure reason or exception message. */
  reason: string;
  /** Zod validation issues, if the failure was a schema mismatch. */
  issues?: ZodIssue[];
}

/**
 * Emits a structured error event.
 *
 * In production this should forward to your observability backend
 * (e.g. Sentry, Datadog, Supabase Edge Logs). For now it logs to
 * stderr so existing behaviour is preserved while the spike is triaged.
 */
export function reportError(event: ErrorEvent): void {
  // eslint-disable-next-line no-console
  console.error('[error-reporting]', JSON.stringify(event));

  // TODO: forward to observability backend, e.g.:
  // await sentryClient.captureEvent({ ...event });
}
