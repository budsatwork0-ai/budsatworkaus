export interface ErrorEvent {
  timestamp: string;
  area: string;
  failureReason: string;
  inputShape: Record<string, unknown>;
  raw?: unknown;
}

export function reportError(event: Omit<ErrorEvent, 'timestamp'>): void {
  const payload: ErrorEvent = {
    timestamp: new Date().toISOString(),
    ...event,
  };

  // Log structured error for observability pipelines / log aggregators.
  console.error('[error-reporting]', JSON.stringify(payload));
}
