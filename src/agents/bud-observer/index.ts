import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Snapshot schema ──────────────────────────────────────────────────────────
// Describes the minimum shape bud-observer expects from its trigger payload.
// Any drift in the snapshot schema will be caught here rather than causing an
// unhandled exception deeper in the pipeline.
const SnapshotSchema = z.object({
  quote_id: z.string(),
  status: z.string(),
  service_type: z.string().optional(),
  created_at: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type ObserverSnapshot = z.infer<typeof SnapshotSchema>;

export type ObserverResult =
  | { outcome: 'analysed'; quote_id: string; notes: string }
  | { outcome: 'unable_to_analyse'; reason: string };

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function handleBudObserver(
  raw: unknown,
): Promise<ObserverResult> {
  // Validate the incoming snapshot before any processing.
  const parsed = SnapshotSchema.safeParse(raw);

  if (!parsed.success) {
    const truncated = JSON.stringify(raw).slice(0, 500);
    console.error(
      '[bud-observer] Invalid snapshot shape — unable_to_analyse.',
      { validationErrors: parsed.error.issues, rawTruncated: truncated },
    );
    return {
      outcome: 'unable_to_analyse',
      reason: `Snapshot schema validation failed: ${parsed.error.issues.map(i => i.message).join('; ')}`,
    };
  }

  const snapshot = parsed.data;

  try {
    const supabase = createServiceClient();

    // Record the observation so downstream agents can consume it.
    const { error } = await supabase.from('bud_observations').insert({
      quote_id: snapshot.quote_id,
      status: snapshot.status,
      service_type: snapshot.service_type ?? null,
      observed_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[bud-observer] DB insert failed', { error, quote_id: snapshot.quote_id });
      return {
        outcome: 'unable_to_analyse',
        reason: `DB error: ${error.message}`,
      };
    }

    return {
      outcome: 'analysed',
      quote_id: snapshot.quote_id,
      notes: `Observation recorded for status=${snapshot.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bud-observer] Unexpected error', { message, quote_id: snapshot.quote_id });
    return {
      outcome: 'unable_to_analyse',
      reason: `Unexpected error: ${message}`,
    };
  }
}
