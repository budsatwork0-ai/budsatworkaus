import { createClient } from '@/lib/supabase/server';

export interface ErrorEvent {
  area: string;
  reason: string;
  message: string;
  inputShape?: Record<string, unknown>;
  occurredAt?: string;
}

export async function reportError(event: ErrorEvent): Promise<void> {
  const payload = {
    area: event.area,
    reason: event.reason,
    message: event.message,
    input_shape: event.inputShape ?? null,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
  };

  try {
    const supabase = await createClient();
    const { error } = await supabase.from('error_events').insert(payload);
    if (error) {
      console.error('[error-reporting] Failed to insert error event:', error.message, payload);
    }
  } catch (err) {
    console.error('[error-reporting] Unexpected failure emitting error event:', err, payload);
  }
}
