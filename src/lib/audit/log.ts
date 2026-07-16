import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuditEntry {
  entity_type: string;
  entity_id: string;
  action: string;
  source: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  user_email?: string | null;
  details?: string | null;
}

/**
 * Writes one row to audit_log. Fire-and-forget: errors are swallowed so
 * a logging failure never blocks the operation being audited.
 * Callers should await this — the insert completes when possible, but any
 * DB error is caught and discarded rather than propagated.
 */
export async function auditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  entry: AuditEntry,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (client as any).from('audit_log').insert([entry]);
  } catch {
    // Intentionally swallowed — audit logging must never interrupt the
    // operation it is recording.
  }
}
