export interface ErrorReport {
  timestamp: string;
  area: string;
  reason: string;
  inputShape: Record<string, unknown>;
  originalError?: unknown;
}

/**
 * Emits a structured error event. Replace the console.error body with your
 * preferred sink (Sentry, Datadog, etc.) without changing the call-sites.
 */
export function reportError(report: ErrorReport): void {
  const payload: ErrorReport = {
    ...report,
    timestamp: report.timestamp ?? new Date().toISOString(),
  };

  // eslint-disable-next-line no-console
  console.error('[error-report]', JSON.stringify(payload));
}
