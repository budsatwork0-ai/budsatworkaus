import { ZodError } from "zod";

export type ErrorArea =
  | "agent/quote-triage"
  | "agent/unknown"
  | string;

export type ErrorReport = {
  timestamp: string;
  area: ErrorArea;
  reason: "validation" | "unexpected" | "missing-env";
  message: string;
  inputShape?: unknown;
  validationIssues?: ZodError["issues"];
};

/**
 * Emits a structured, labelled error event.
 * In production this can be wired to your observability platform;
 * for now it writes to stderr so it is always visible in logs.
 */
export function reportError(
  area: ErrorArea,
  reason: ErrorReport["reason"],
  error: unknown,
  inputShape?: unknown
): void {
  const report: ErrorReport = {
    timestamp: new Date().toISOString(),
    area,
    reason,
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : JSON.stringify(error),
    inputShape,
    validationIssues:
      error instanceof ZodError ? error.issues : undefined,
  };

  // Always write to stderr so CI / log aggregators capture it.
  console.error("[ERROR_REPORT]", JSON.stringify(report));

  // TODO: wire to your observability sink (e.g. Sentry, Datadog) here.
}
