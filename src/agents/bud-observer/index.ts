import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Schema ──────────────────────────────────────────────────────────────────
const SnapshotSchema = z.object({
  id: z.string(),
  agent_name: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  success_count: z.number().int().default(0),
  failure_count: z.number().int().default(0),
  error_messages: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type Snapshot = z.infer<typeof SnapshotSchema>;

// ─── Error types ─────────────────────────────────────────────────────────────
export class SchemaValidationError extends Error {
  constructor(
    public readonly issues: z.ZodIssue[],
    public readonly truncatedInput: string,
  ) {
    super('bud-observer: snapshot failed schema validation');
    this.name = 'SchemaValidationError';
  }
}

// ─── Result types ────────────────────────────────────────────────────────────
export type ObserverResult =
  | { status: 'ok'; agent_name: string; inserted_id: string }
  | { status: 'unable_to_analyse'; reason: string; truncatedInput?: string }
  | { status: 'db_error'; message: string };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MAX_LOG_LENGTH = 500;

function truncate(input: unknown): string {
  const s = JSON.stringify(input) ?? String(input);
  return s.length > MAX_LOG_LENGTH ? s.slice(0, MAX_LOG_LENGTH) + '…[truncated]' : s;
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function runBudObserver(rawSnapshot: unknown): Promise<ObserverResult> {
  // Validate at the boundary
  const parsed = SnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success) {
    const truncatedInput = truncate(rawSnapshot);
    console.error('[bud-observer] Schema validation failed', {
      issues: parsed.error.issues,
      truncatedInput,
    });
    return {
      status: 'unable_to_analyse',
      reason: 'snapshot failed schema validation',
      truncatedInput,
    };
  }

  const snapshot = parsed.data;

  // Lazy Supabase init — only after validation passes
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('agent_observations')
    .insert({
      agent_name: snapshot.agent_name,
      period_start: snapshot.period_start,
      period_end: snapshot.period_end,
      success_count: snapshot.success_count,
      failure_count: snapshot.failure_count,
      error_messages: snapshot.error_messages,
      metadata: snapshot.metadata,
      source_snapshot_id: snapshot.id,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[bud-observer] DB insert failed', { message: error.message });
    return { status: 'db_error', message: error.message };
  }

  return {
    status: 'ok',
    agent_name: snapshot.agent_name,
    inserted_id: (data as { id: string }).id,
  };
}
