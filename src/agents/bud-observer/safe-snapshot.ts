/**
 * safeSnapshot — wraps a single data-source fetch so that one failing source
 * returns a typed partial result instead of crashing the whole observer run.
 */

export type FailureKind =
  | 'timeout'
  | 'schema_mismatch'
  | 'network_error'
  | 'unknown';

export interface SnapshotSuccess<T> {
  ok: true;
  source: string;
  data: T;
}

export interface SnapshotFailure {
  ok: false;
  source: string;
  failureKind: FailureKind;
  message: string;
}

export type SnapshotResult<T> = SnapshotSuccess<T> | SnapshotFailure;

function classifyError(err: unknown): FailureKind {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout';
    if (
      msg.includes('schema') ||
      msg.includes('parse') ||
      msg.includes('validation') ||
      msg.includes('zod')
    )
      return 'schema_mismatch';
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    )
      return 'network_error';
  }
  return 'unknown';
}

/**
 * Executes `fn` and returns a typed result discriminated by `ok`.
 * Never throws — callers receive either a success or a structured failure.
 */
export async function safeSnapshot<T>(
  source: string,
  fn: () => Promise<T>,
): Promise<SnapshotResult<T>> {
  try {
    const data = await fn();
    return { ok: true, source, data };
  } catch (err: unknown) {
    const failureKind = classifyError(err);
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        agent: 'bud-observer',
        source,
        failureKind,
        message,
      }),
    );
    return { ok: false, source, failureKind, message };
  }
}
