import { createClient } from '@/lib/supabase/server';

export interface ErrorReport {
  timestamp: string;
  area: string;
  reason: string;
  inputShape: Record<string, unknown>;
  raw?: unknown;
}

export async function reportError(report: ErrorReport): Promise<void> {
  console.error('[error-reporting]', JSON.stringify(report));

  try {
    const supabase = await createClient();
    await supabase.from('error_log').insert({
      timestamp: report.timestamp,
      area: report.area,
      reason: report.reason,
      input_shape: report.inputShape,
      raw: report.raw !== undefined ? String(report.raw) : null,
    });
  } catch (persistErr) {
    // Best-effort persistence — log but don't throw so callers are never blocked.
    console.error('[error-reporting] failed to persist error report', persistErr);
  }
}
