/**
 * dead-letter-queue.ts
 *
 * Typed insert helper that writes dead-letter records to Supabase.
 * Never throws into calling code — all errors are swallowed and logged
 * so that a dead-letter failure never breaks the primary flow.
 */

import { createServiceClient } from '@/lib/supabase/server';

export type DeadLetterReason =
  | 'empty_output'
  | 'signal_starvation'
  | 'schema_violation'
  | 'unexpected_error';

export interface DeadLetterRecord {
  agent_name: string;
  reason: DeadLetterReason;
  detail: string;
  payload?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Enqueues a dead-letter record.
 * Returns `true` on success, `false` on failure (failure is also console.error'd).
 */
export async function enqueueDeadLetter(
  record: DeadLetterRecord,
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase.from('agent_dead_letters').insert({
      agent_name: record.agent_name,
      reason: record.reason,
      detail: record.detail,
      payload: record.payload ?? null,
      created_at: record.created_at ?? new Date().toISOString(),
    });
    if (error) {
      console.error('[dead-letter-queue] Insert error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[dead-letter-queue] Unexpected error:', err);
    return false;
  }
}
