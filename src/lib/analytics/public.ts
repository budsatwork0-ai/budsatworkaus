'use client';

import { PUBLIC_ANALYTICS_SESSION_KEY, type AnalyticsEventData } from '@/lib/analytics/shared';

type TrackPublicAnalyticsEventInput = {
  eventName: string;
  eventLabel?: string | null;
  page?: string;
  quoteId?: string | null;
  orderId?: string | null;
  eventValue?: number | null;
  eventData?: AnalyticsEventData;
  useBeacon?: boolean;
};

export function getPublicAnalyticsSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage.getItem(PUBLIC_ANALYTICS_SESSION_KEY);
  } catch {
    return null;
  }
}

export function getOrCreatePublicAnalyticsSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  const existing = getPublicAnalyticsSessionId();
  if (existing) return existing;

  const id =
    typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `baw_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  try {
    window.localStorage.setItem(PUBLIC_ANALYTICS_SESSION_KEY, id);
  } catch {
    return null;
  }

  return id;
}

export async function trackPublicAnalyticsEvent({
  eventName,
  eventLabel,
  page,
  quoteId,
  orderId,
  eventValue,
  eventData,
  useBeacon = false,
}: TrackPublicAnalyticsEventInput): Promise<void> {
  if (typeof window === 'undefined') return;

  const sessionId = getOrCreatePublicAnalyticsSessionId();
  if (!sessionId) return;

  const payload = {
    session_id: sessionId,
    page: page ?? window.location.pathname,
    page_title: document.title,
    event_type: 'event',
    event_name: eventName,
    ...(eventLabel ? { event_label: eventLabel } : {}),
    ...(quoteId ? { quote_id: quoteId } : {}),
    ...(orderId ? { order_id: orderId } : {}),
    ...(typeof eventValue === 'number' && Number.isFinite(eventValue) ? { event_value: eventValue } : {}),
    ...(eventData && Object.keys(eventData).length > 0 ? { event_data: eventData } : {}),
  };

  try {
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/track', JSON.stringify(payload));
      return;
    }

    await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Tracking must not affect the user flow.
  }
}
