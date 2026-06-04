import { z } from 'zod';

// ─── Lazy Supabase init ───────────────────────────────────────────────────────
let _supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createServiceClient>> | null = null;
function getSupabase() {
  if (!_supabase) {
    // Will throw a clear error at call-time (not at module load) if env vars are absent
    const { createServiceClient } = require('@/lib/supabase/server') as typeof import('@/lib/supabase/server');
    _supabase = createServiceClient();
  }
  return _supabase;
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const SnapshotSchema = z.object({
  agent: z.string(),
  week_start: z.string(),
  error_count: z.number(),
  prev_error_count: z.number().optional(),
  total_errors: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BudObserverSnapshot = z.infer<typeof SnapshotSchema>;

export interface BudObserverResult {
  status: 'ok' | 'unable_to_analyse' | 'db_error';
  error?: string;
  error_code?: string;
  agent?: string;
  week_start?: string;
  error_count?: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RAW_LOG_MAX_LENGTH = 500;

// ─── Entry point ─────────────────────────────────────────────────────────────
export async function runBudObserver(raw: unknown): Promise<BudObserverResult> {
  // Validate input
  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    const truncated = JSON.stringify(raw).slice(0, RAW_LOG_MAX_LENGTH);
    console.error('[bud-observer] SchemaValidationError', {
      error_code: 'SCHEMA_VALIDATION_ERROR',
      issues: parsed.error.issues,
      raw_truncated: truncated,
    });
    return {
      status: 'unable_to_analyse',
      error: 'Input did not match expected snapshot schema.',
      error_code: 'SCHEMA_VALIDATION_ERROR',
    };
  }

  const snapshot = parsed.data;

  // Persist observation
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('bud_observer_snapshots')
      .insert({
        agent: snapshot.agent,
        week_start: snapshot.week_start,
        error_count: snapshot.error_count,
        prev_error_count: snapshot.prev_error_count ?? null,
        total_errors: snapshot.total_errors ?? null,
        metadata: snapshot.metadata ?? null,
      });

    if (error) {
      console.error('[bud-observer] DB insert error', { error_code: 'DB_INSERT_ERROR', message: error.message });
      return {
        status: 'db_error',
        error: error.message,
        error_code: 'DB_INSERT_ERROR',
        agent: snapshot.agent,
        week_start: snapshot.week_start,
        error_count: snapshot.error_count,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[bud-observer] Unexpected error', { error_code: 'UNEXPECTED_ERROR', message });
    return {
      status: 'db_error',
      error: message,
      error_code: 'UNEXPECTED_ERROR',
      agent: snapshot.agent,
      week_start: snapshot.week_start,
      error_count: snapshot.error_count,
    };
  }

  return {
    status: 'ok',
    agent: snapshot.agent,
    week_start: snapshot.week_start,
    error_count: snapshot.error_count,
  };
}
