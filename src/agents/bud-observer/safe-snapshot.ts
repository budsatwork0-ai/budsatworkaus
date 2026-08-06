/**
 * safeSnapshot — wraps a per-source async data-fetch so that one failing
 * source never aborts the entire bud-observer snapshot run.
 *
 * Failures are logged with a `failureKind` discriminator so they are
 * distinguishable in logs and dashboards.
 */

export type FailureKind = 'llm' | 'data_fetch' | 'serialisation';

export interface SnapshotFailure {
  source: string;
  failureKind: FailureKind;
  message: string;
  stack?: string;
}

export interface SnapshotResult<T> {
  data: T | null;
  failure: SnapshotFailure | null;
}

/**
 * Classify an unknown thrown value into one of the failure kinds.
 * Heuristic: check the error message for known patterns; default to data_fetch.
 */
function classifyError(err: unknown): FailureKind {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  if (
    msg.includes('llm') ||
    msg.includes('openai') ||
    msg.includes('anthropic') ||
    msg.includes('completion') ||
    msg.includes('model')
  ) {
    return 'llm';
  }
  if (
    msg.includes('json') ||
    msg.includes('parse') ||
    msg.includes('serial') ||
    msg.includes('stringify')
  ) {
    return 'serialisation';
  }
  return 'data_fetch';
}

/**
 * Wrap an async producer for a named source.  Always resolves — never rejects.
 */
export async function safeSnapshot<T>(
  source: string,
  producer: () => Promise<T>,
): Promise<SnapshotResult<T>> {
  try {
    const data = await producer();
    return { data, failure: null };
  } catch (err) {
    const failureKind = classifyError(err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;

    const failure: SnapshotFailure = { source, failureKind, message, stack };

    // Structured log — dashboards can filter on failureKind
    console.error(
      JSON.stringify({
        level: 'error',
        agent: 'bud-observer',
        source,
        failureKind,
        message,
      }),
    );

    return { data: null, failure };
  }
}
