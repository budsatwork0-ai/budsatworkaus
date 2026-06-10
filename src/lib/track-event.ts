/**
 * Lightweight client-side event tracker.
 * Posts structured conversion/UX events to /api/events.
 * Fire-and-forget — never throws, never blocks the UI.
 */
export interface TrackEventPayload {
  action: string;
  entity_type: string;
  entity_id: string;
  details?: Record<string, unknown>;
  source?: string;
}

export function trackEvent(payload: TrackEventPayload): void {
  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Silently swallow network errors — tracking must never break the UI
    });
  } catch {
    // Silently swallow any synchronous errors
  }
}
