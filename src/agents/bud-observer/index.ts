/**
 * bud-observer agent entry point.
 *
 * Changes vs previous draft:
 *  1. Zod input schema validates the raw data snapshot at entry — malformed
 *     upstream data is rejected with a typed error before any processing.
 *  2. Full snapshot-parsing + signal-generation pipeline is wrapped in a
 *     top-level try/catch that emits a structured 'observer_failed' signal
 *     on any unhandled error.
 *  3. safeSnapshot is wired in for every data-source fetch so per-source
 *     failures produce partial ObserverReport output rather than a full crash.
 */

import { z } from 'zod';
import { safeSnapshot, type SnapshotFailure } from './safe-snapshot';

// ─── Input schema ─────────────────────────────────────────────────────────────
// Validates the raw snapshot payload delivered to this agent.
// Any field beyond these is stripped (strip is the Zod v4 default).
const DataSnapshotSchema = z.object({
  /** Unix epoch ms — when the snapshot was collected */
  collectedAt: z.number(),
  /** Arbitrary keyed source blobs; each value is validated per-source below */
  sources: z.record(z.string(), z.unknown()).optional(),
});

type DataSnapshot = z.infer<typeof DataSnapshotSchema>;

// ─── Output types ─────────────────────────────────────────────────────────────
export type ObserverSignal = {
  kind: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
  meta?: Record<string, unknown>;
};

export type ObserverReport = {
  collectedAt: number;
  processedAt: number;
  signals: ObserverSignal[];
  degradedSources: string[];
  partial: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emitObserverFailed(failureKind: string, message: string): ObserverReport {
  console.error(
    JSON.stringify({
      level: 'error',
      agent: 'bud-observer',
      event: 'observer_failed',
      failureKind,
      message,
    }),
  );

  return {
    collectedAt: Date.now(),
    processedAt: Date.now(),
    signals: [
      {
        kind: 'observer_failed',
        severity: 'error',
        message,
        meta: { failureKind },
      },
    ],
    degradedSources: [],
    partial: true,
  };
}

// ─── Per-source processors ────────────────────────────────────────────────────
// Each processor receives the raw unknown value for its source key and returns
// zero or more signals.  Add new sources here as the platform grows.
async function processSource(
  sourceName: string,
  raw: unknown,
): Promise<ObserverSignal[]> {
  // Placeholder: real implementations would parse + analyse each source.
  // Returning an empty array keeps the contract without any analysis yet.
  void sourceName;
  void raw;
  return [];
}

// ─── Main entry point ─────────────────────────────────────────────────────────
export async function runObserver(rawInput: unknown): Promise<ObserverReport> {
  // 1. Validate input schema — reject malformed snapshots before any processing.
  const parseResult = DataSnapshotSchema.safeParse(rawInput);
  if (!parseResult.success) {
    const message = parseResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    return emitObserverFailed('input_validation_error', message);
  }

  const snapshot: DataSnapshot = parseResult.data;

  // 2. Top-level try/catch — any unhandled error emits observer_failed.
  try {
    const signals: ObserverSignal[] = [];
    const degradedSources: string[] = [];

    const sources = snapshot.sources ?? {};
    const sourceEntries = Object.entries(sources);

    // 3. Process each source through safeSnapshot so a single failure doesn't
    //    crash the whole run — it contributes to degradedSources instead.
    await Promise.all(
      sourceEntries.map(async ([sourceName, rawValue]) => {
        const result = await safeSnapshot(sourceName, () =>
          processSource(sourceName, rawValue),
        );

        if (result.ok) {
          signals.push(...result.data);
        } else {
          const failure = result as SnapshotFailure;
          degradedSources.push(sourceName);
          signals.push({
            kind: 'source_degraded',
            severity: 'warn',
            message: failure.message,
            source: sourceName,
            meta: { failureKind: failure.failureKind },
          });
        }
      }),
    );

    const report: ObserverReport = {
      collectedAt: snapshot.collectedAt,
      processedAt: Date.now(),
      signals,
      degradedSources,
      partial: degradedSources.length > 0,
    };

    console.info(
      JSON.stringify({
        level: 'info',
        agent: 'bud-observer',
        event: 'observer_complete',
        signalCount: signals.length,
        degradedSources,
        partial: report.partial,
      }),
    );

    return report;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return emitObserverFailed('unhandled_error', message);
  }
}
