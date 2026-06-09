/**
 * design-developer-error-types.ts
 *
 * Canonical error types for the design-developer agent pipeline.
 * Consumed by the agent runner wrapper and surfaced as structured,
 * human-readable error objects with triage guidance.
 */

// ─── Error codes ──────────────────────────────────────────────────────────────

export type DesignDeveloperErrorCode =
  | 'MALFORMED_INPUT'
  | 'LLM_TOOL_CALL_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'OUTPUT_VALIDATION_ERROR';

// ─── Structured error ─────────────────────────────────────────────────────────

export interface DesignDeveloperError {
  /** Machine-readable error classification */
  errorCode: DesignDeveloperErrorCode;
  /** Human-readable summary for logs / UX signals */
  message: string;
  /** Triage guidance for the developer or on-call engineer */
  triage: string;
  /** The original Error, if available */
  cause?: unknown;
  /** ISO timestamp of when the error was classified */
  timestamp: string;
  /** The taskId from the input payload, if it was parseable */
  taskId?: string;
}

// ─── Error builder helpers ────────────────────────────────────────────────────

export function buildDesignDeveloperError(
  errorCode: DesignDeveloperErrorCode,
  message: string,
  triage: string,
  cause?: unknown,
  taskId?: string
): DesignDeveloperError {
  return {
    errorCode,
    message,
    triage,
    cause,
    timestamp: new Date().toISOString(),
    taskId,
  };
}

/**
 * Classifies an unknown thrown value into one of the three pipeline error codes.
 * Heuristics:
 *  - Errors whose message contains 'tool' or 'function_call' → LLM_TOOL_CALL_ERROR
 *  - Errors whose message contains 'write' or 'ENOENT' or 'EACCES' → FILE_WRITE_ERROR
 *  - Everything else → LLM_TOOL_CALL_ERROR (LLM call is the most likely runtime failure)
 */
export function classifyUnknownError(
  err: unknown,
  taskId?: string
): DesignDeveloperError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes('tool') || lower.includes('function_call') || lower.includes('finish_reason')) {
    return buildDesignDeveloperError(
      'LLM_TOOL_CALL_ERROR',
      `LLM tool call failed during design-developer execution: ${msg}`,
      'Inspect the LLM response for malformed tool call payloads. ' +
        'Check that the model supports function calling and that the tool schema is valid. ' +
        'Retry with a simpler prompt if the model exceeded context length.',
      err,
      taskId
    );
  }

  if (
    lower.includes('write') ||
    lower.includes('enoent') ||
    lower.includes('eacces') ||
    lower.includes('permission') ||
    lower.includes('file')
  ) {
    return buildDesignDeveloperError(
      'FILE_WRITE_ERROR',
      `File write failed during design-developer execution: ${msg}`,
      'Verify the outputPath is valid and that the process has write permissions. ' +
        'Check that the target directory exists before invoking the agent. ' +
        'On CI, ensure the workspace is not read-only.',
      err,
      taskId
    );
  }

  return buildDesignDeveloperError(
    'LLM_TOOL_CALL_ERROR',
    `Unexpected error during design-developer execution: ${msg}`,
    'Review the full stack trace. If the error originates in the LLM client, ' +
      'check API key validity, rate limits, and network connectivity. ' +
      'If reproducible, add the error message pattern to classifyUnknownError for finer triage.',
    err,
    taskId
  );
}
