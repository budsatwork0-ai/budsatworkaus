export interface ErrorReport {
  timestamp: string;
  area: string;
  reason: string;
  inputShape: Record<string, unknown>;
}

export function reportError(
  area: string,
  reason: string,
  inputShape: Record<string, unknown>
): void {
  const report: ErrorReport = {
    timestamp: new Date().toISOString(),
    area,
    reason,
    inputShape,
  };

  // Emit to console as structured JSON so log aggregators can index it.
  console.error(JSON.stringify(report));

  // If a global error sink is registered (e.g. Sentry, Datadog) forward there too.
  if (
    typeof globalThis !== 'undefined' &&
    typeof (globalThis as Record<string, unknown>).__errorSink === 'function'
  ) {
    (globalThis as Record<string, (r: ErrorReport) => void>).__errorSink(report);
  }
}
