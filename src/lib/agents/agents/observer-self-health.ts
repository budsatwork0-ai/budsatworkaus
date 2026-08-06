/**
 * Thin wrapper that adds self-health monitoring around any bud-observer
 * run function.  Purely additive — the existing agent source is not modified.
 *
 * Usage (future wiring):
 *   import { wrapObserverRun } from './observer-self-health';
 *   export const run = wrapObserverRun(rawObserverRun);
 */

import {
  OBSERVER_DEGRADED_CHANNEL,
  ObserverDegradedPayload,
  buildDegradedPayload,
} from './observer-fallback-signal';

// ---------------------------------------------------------------------------
// Alert emission
// ---------------------------------------------------------------------------

/**
 * Emits the degraded payload to the dedicated alert channel.
 * Implemented as a console.error write so it is safe to call in any
 * runtime (Edge, Node, test) without a Supabase dependency here.
 * Replace the body with a real channel publish once wiring is ready.
 */
function emitDegradedAlert(payload: ObserverDegradedPayload): void {
  // Log to stderr so the signal is always visible in server logs.
  console.error(
    `[${OBSERVER_DEGRADED_CHANNEL}]`,
    JSON.stringify(payload),
  );
}

// ---------------------------------------------------------------------------
// Public wrapper
// ---------------------------------------------------------------------------

/** Minimal contract expected of a bud-observer run function. */
export type ObserverRunFn<TInput, TOutput> = (
  input: TInput,
) => Promise<TOutput>;

/**
 * Wraps an observer run function so that:
 *  1. JSON parse errors are caught, a degraded signal is emitted, and the
 *     error is re-thrown (preserving existing error-propagation behaviour).
 *  2. An empty output array on a non-empty input is detected, a degraded
 *     signal is emitted, and the empty array is returned (non-destructive).
 *
 * @param fn   The original observer run function.
 * @returns    A wrapped function with identical signature.
 */
export function wrapObserverRun<TInput, TOutput>(
  fn: ObserverRunFn<TInput, TOutput>,
): ObserverRunFn<TInput, TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    // Determine input "size" for diagnostic purposes.
    const inputLength =
      typeof input === 'string'
        ? input.length
        : typeof input === 'object' && input !== null
        ? JSON.stringify(input).length
        : undefined;

    let output: TOutput;

    try {
      output = await fn(input);
    } catch (err: unknown) {
      const isJsonError =
        err instanceof SyntaxError ||
        (err instanceof Error && err.message.toLowerCase().includes('json'));

      const reason = isJsonError ? 'json_parse_error' : 'unexpected_error';
      const message = err instanceof Error ? err.message : String(err);

      emitDegradedAlert(buildDegradedPayload(reason, message, inputLength));
      throw err; // re-throw so the caller's error handling is unaffected
    }

    // Detect empty-signals-on-non-empty-input.
    const isEmptyOutput =
      Array.isArray(output) && (output as unknown[]).length === 0;
    const hasNonEmptyInput =
      inputLength !== undefined && inputLength > 0;

    if (isEmptyOutput && hasNonEmptyInput) {
      emitDegradedAlert(
        buildDegradedPayload(
          'empty_signals_on_non_empty_input',
          'Observer returned an empty signal array despite receiving non-empty input.',
          inputLength,
        ),
      );
    }

    return output;
  };
}
