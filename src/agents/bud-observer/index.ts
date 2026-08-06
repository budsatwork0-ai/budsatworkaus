import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Schema ───────────────────────────────────────────────────────────────────
const SnapshotSchema = z.object({
  agent_id: z.string(),
  captured_at: z.string(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  errors: z.array(z.unknown()).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

export type ObserverResult =
  | { status: 'ok'; agent_id: string }
  | { status: 'unable_to_analyse'; reason: string; error_code: string }
  | { status: 'db_error'; reason: string };

// ─── Lazy Supabase init ───────────────────────────────────────────────────────
let _supabase: ReturnType<typeof createServiceClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createServiceClient();
  return _supabase;
}

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function runBudObserver(raw: unknown): Promise<ObserverResult> {
  // Truncated raw input log — max 500 chars to avoid log bloat
  const truncated = JSON.stringify(raw)?.slice(0, 500) ?? '(non-serialisable)';
  console.log('[bud-observer] raw snapshot (truncated):', truncated);

  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[bud-observer] SchemaValidationError:', parsed.error.flatten());
    return {
      status: 'unable_to_analyse',
      reason: 'Snapshot failed schema validation',
      error_code: 'SchemaValidationError',
    };
  }

  const snapshot = parsed.data;

  const supabase = getSupabase();
  const { error } = await supabase.from('observer_snapshots').insert({
    agent_id: snapshot.agent_id,
    captured_at: snapshot.captured_at,
    metrics: snapshot.metrics ?? null,
    errors: snapshot.errors ?? null,
    meta: snapshot.meta ?? null,
  });

  if (error) {
    console.error('[bud-observer] DB insert error:', error.message);
    return { status: 'db_error', reason: error.message };
  }

  return { status: 'ok', agent_id: snapshot.agent_id };
}
