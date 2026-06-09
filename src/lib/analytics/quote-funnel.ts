'use client';

// Separate session key for funnel tracking — uses sessionStorage so it resets
// on each new tab/browser session, giving true per-session funnel data.
// The persistent visitor ID (_baw_sid in localStorage) is intentionally kept
// separate; add a visitor_id column later if cross-session attribution is needed.
const FUNNEL_SESSION_KEY = '_baw_fsid';

function getOrCreateFunnelSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.sessionStorage.getItem(FUNNEL_SESSION_KEY);
    if (existing) return existing;
    const id =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `baw_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(FUNNEL_SESSION_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export type FunnelEventName =
  | 'service_selected'
  | 'card_expanded'
  | 'config_started'
  | 'add_to_quote'
  | 'quote_submitted';

export type FunnelEventPayload = {
  service?: string | null;
  scope?: string | null;
  context?: string | null;
  time_spent_seconds?: number | null;
  config_changes?: number | null;
  quote_submitted?: boolean | null;
};

export function trackFunnelEvent(
  eventName: FunnelEventName,
  payload: FunnelEventPayload = {},
): void {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreateFunnelSessionId();
  if (!sessionId) return;

  const body = JSON.stringify({
    session_id: sessionId,
    event_name: eventName,
    ...payload,
  });

  try {
    void fetch('/api/analytics/quote-funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Tracking must never affect the user flow.
  }
}
