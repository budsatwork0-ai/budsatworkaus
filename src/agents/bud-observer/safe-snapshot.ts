/**
 * safeSnapshot — wraps a data-source fetch so a per-source failure returns a
 * typed partial result and emits a structured log instead of crashing the run.
 */

export type SnapshotSuccess<T> = {
  ok: true;
  data: T;
};

export type SnapshotFailure = {
  ok: false;
  failureKind: 'fetch_error' | 'parse_error' | 'unknown';
  message: string;
};

export type SnapshotResult<T> = SnapshotSuccess<T> | SnapshotFailure;

export async function safeSnapshot<T>(
  sourceName: string,
  fn: () => Promise<T>,
): Promise<SnapshotResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failureKind: SnapshotFailure['failureKind'] =
      err instanceof SyntaxError ? 'parse_error' : 'fetch_error';

    console.error(
      JSON.stringify({
        level: 'error',
        agent: 'bud-observer',
        event: 'source_failed',
        source: sourceName,
        failureKind,
        message,
      }),
    );

    return { ok: false, failureKind, message };
  }
}
