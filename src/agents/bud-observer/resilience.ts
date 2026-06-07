/**
 * Resilience utilities for the bud-observer agent.
 * Provides retry-with-backoff and degraded-alert emission.
 */

/** Sleep for `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with up to `maxRetries` retries using
 * exponential backoff with jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff: 200ms, 400ms, … with ±20 % jitter
        const base = 200 * Math.pow(2, attempt);
        const jitter = base * 0.2 * (Math.random() * 2 - 1);
        await sleep(Math.round(base + jitter));
      }
    }
  }
  throw lastError;
}

export interface DegradedAlertPayload {
  agent: string;
  stage: string;
  error: string;
  timestamp: string;
}

/**
 * POSTs a minimal failure payload to ALERT_WEBHOOK_URL.
 * Failures are swallowed so the alert path never masks the original error.
 */
export async function emitDegradedAlert(
  payload: DegradedAlertPayload,
): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) {
    console.warn('[bud-observer] ALERT_WEBHOOK_URL not set — skipping alert');
    return;
  }
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[bud-observer] Failed to emit degraded alert:', err);
  }
}
