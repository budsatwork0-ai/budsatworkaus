/**
 * Pipeline health-check utility.
 * Warns (via console.warn) if ux_proposals or conversion_signals
 * have been empty for more than 24 hours, using a persisted
 * last-emission timestamp stored in Supabase (pipeline_health table).
 */
import { createServiceClient } from '@/lib/supabase/server';

const TABLES_TO_MONITOR = ['ux_proposals', 'conversion_signals'] as const;
type MonitoredTable = (typeof TABLES_TO_MONITOR)[number];

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Records the current timestamp as the last emission time for the given table.
 * Call this whenever a row is successfully inserted into `tableName`.
 */
export async function recordPipelineEmission(tableName: MonitoredTable): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('pipeline_health')
    .upsert(
      { table_name: tableName, last_emitted_at: new Date().toISOString() },
      { onConflict: 'table_name' }
    );
  if (error) {
    console.warn('[pipeline-health] Failed to record emission timestamp:', error.message);
  }
}

/**
 * Checks all monitored tables. Logs a warning for any table whose
 * last recorded emission is older than STALE_THRESHOLD_MS (or has never emitted).
 */
export async function checkPipelineHealth(): Promise<void> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('pipeline_health')
    .select('table_name, last_emitted_at')
    .in('table_name', TABLES_TO_MONITOR);

  if (error) {
    console.warn('[pipeline-health] Could not read pipeline_health table:', error.message);
    return;
  }

  const now = Date.now();
  const recordedMap = new Map<string, string>(
    (data ?? []).map((row) => [row.table_name as string, row.last_emitted_at as string])
  );

  for (const table of TABLES_TO_MONITOR) {
    const lastEmittedStr = recordedMap.get(table);
    if (!lastEmittedStr) {
      console.warn(
        `[pipeline-health] WARNING: No emission ever recorded for "${table}". Pipeline may be silent.`
      );
      continue;
    }
    const lastEmittedMs = new Date(lastEmittedStr).getTime();
    if (isNaN(lastEmittedMs)) {
      console.warn(
        `[pipeline-health] WARNING: Invalid last_emitted_at value for "${table}": ${lastEmittedStr}`
      );
      continue;
    }
    const ageMs = now - lastEmittedMs;
    if (ageMs > STALE_THRESHOLD_MS) {
      const ageHours = (ageMs / (60 * 60 * 1000)).toFixed(1);
      console.warn(
        `[pipeline-health] WARNING: "${table}" has been silent for ${ageHours}h (last emission: ${lastEmittedStr}). Pipeline may be stuck.`
      );
    }
  }
}
