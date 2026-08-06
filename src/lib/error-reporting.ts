export interface ErrorEvent {
  timestamp: string;
  area: string;
  reason: string;
  inputShape: Record<string, unknown>;
  originalError?: unknown;
}

/**
 * Emits a structured error event so every failure class is immediately
 * visible in the dashboard (console in dev; extend to your telemetry sink).
 */
export function reportError(
  area: string,
  reason: string,
  inputShape: Record<string, unknown>,
  originalError?: unknown
): void {
  const event: ErrorEvent = {
    timestamp: new Date().toISOString(),
    area,
    reason,
    inputShape,
    originalError,
  };

  // Always log in a structured, grep-friendly format.
  console.error('[error-reporting]', JSON.stringify({
    timestamp: event.timestamp,
    area: event.area,
    reason: event.reason,
    inputShape: event.inputShape,
    // Serialise originalError safely.
    error:
      event.originalError instanceof Error
        ? { message: event.originalError.message, stack: event.originalError.stack }
        : event.originalError,
  }));

  // TODO: forward `event` to your telemetry/dashboard sink here.
}
