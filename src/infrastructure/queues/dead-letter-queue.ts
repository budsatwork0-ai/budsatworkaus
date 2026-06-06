import { createServiceClient } from '@/lib/supabase/server';

export interface DeadLetterRecord {
  agent_id: string;
  run_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

/**
 * Writes a structured dead-letter record to the agent_dead_letters table.
 * Errors are swallowed so a telemetry failure never kills the caller.
 */
export async function insertDeadLetter(record: DeadLetterRecord): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('agent_dead_letters').insert({
      agent_id: record.agent_id,
      run_id: record.run_id,
      payload: record.payload,
      timestamp: record.timestamp,
    });
  } catch {
    // Intentionally silent — dead-letter writes must not surface as user errors.
  }
}
