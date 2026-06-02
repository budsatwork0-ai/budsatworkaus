import { z, ZodSchema } from 'zod';

export interface ResilienceOptions<TFallback> {
  /** Human-readable name used in structured log output */
  agentName: string;
  /** Zod schema to validate the raw input before calling fn */
  inputSchema?: ZodSchema;
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number;
  /** Base delay in ms for exponential back-off (default: 200) */
  baseDelayMs?: number;
  /** Guaranteed fallback value returned when all attempts fail */
  fallback: TFallback;
}

export interface AgentResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  attempts: number;
}

/** Structured log sink — writes to stderr in a machine-parseable format. */
function logError(
  agentName: string,
  attempt: number,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      agent: agentName,
      attempt,
      message,
      stack,
      ...context,
      ts: new Date().toISOString(),
    }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Higher-order wrapper that adds:
 * - Optional Zod input validation
 * - Exponential-backoff retry
 * - Structured error logging
 * - A guaranteed fallback response shape
 */
export async function withAgentResilience<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  input: TInput,
  options: ResilienceOptions<TOutput>,
): Promise<AgentResult<TOutput>> {
  const {
    agentName,
    inputSchema,
    maxAttempts = 3,
    baseDelayMs = 200,
    fallback,
  } = options;

  // ── Input validation ──────────────────────────────────────────────────────
  if (inputSchema) {
    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      const message = parsed.error.message;
      logError(agentName, 0, new Error(`Input validation failed: ${message}`));
      return { ok: false, data: fallback, error: message, attempts: 0 };
    }
  }

  // ── Retry loop with exponential back-off ──────────────────────────────────
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fn(input);
      return { ok: true, data, error: null, attempts: attempt };
    } catch (err) {
      lastError = err;
      logError(agentName, attempt, err, { maxAttempts });

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  // ── All attempts exhausted — return fallback ──────────────────────────────
  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  return {
    ok: false,
    data: fallback,
    error: errorMessage,
    attempts: maxAttempts,
  };
}
