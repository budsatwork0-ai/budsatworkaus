export interface ErrorReport {
  area: string;
  reason: string;
  inputShape: Record<string, unknown>;
  timestamp: string;
  raw?: unknown;
}

export function reportError(report: ErrorReport): void {
  console.error(JSON.stringify({
    ...report,
    timestamp: report.timestamp ?? new Date().toISOString(),
  }));
}
