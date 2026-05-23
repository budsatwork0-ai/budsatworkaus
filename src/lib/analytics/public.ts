'use client';

import {
  LEAD_ATTRIBUTION_STORAGE_KEY,
  PUBLIC_ANALYTICS_SESSION_KEY,
  type AnalyticsEventData,
  type LeadAttribution,
} from '@/lib/analytics/shared';

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

/**
 * Capture utm_* params + document.referrer + landing path once per tab and
 * stash them in sessionStorage. Idempotent — subsequent calls are no-ops
 * unless `force` is set. First-touch wins because the ad platforms credit
 * first-touch; if the user bounces between landing pages we don't want to
 * overwrite the original source.
 *
 * Safe to call from any client component's mount effect (Next.js SSR-safe).
 */
export function captureLeadAttribution(force = false): LeadAttribution | null {
  if (typeof window === 'undefined') return null;

  try {
    const existing = window.sessionStorage.getItem(LEAD_ATTRIBUTION_STORAGE_KEY);
    if (existing && !force) {
      try {
        return JSON.parse(existing) as LeadAttribution;
      } catch {
        // Fall through and re-capture if the stored payload is malformed.
      }
    }
  } catch {
    // sessionStorage may be blocked (private mode, strict cookies). Treat
    // attribution as missing — server defaults to 'website'.
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const pick = (key: string): string | null => {
    const v = params.get(key);
    return v && v.trim() ? v.trim().slice(0, 120) : null;
  };

  const referrer = (() => {
    const raw = typeof document !== 'undefined' ? document.referrer : '';
    if (!raw) return null;
    // Drop same-origin referrers — those just mean the user navigated within
    // the site and we don't want them masking the real first-touch source.
    try {
      const url = new URL(raw);
      if (url.host === window.location.host) return null;
      return raw.slice(0, 250);
    } catch {
      return raw.slice(0, 250);
    }
  })();

  const snapshot: LeadAttribution = {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_term: pick('utm_term'),
    utm_content: pick('utm_content'),
    referrer,
    landing_path: window.location.pathname + window.location.search,
    captured_at: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(LEAD_ATTRIBUTION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Best-effort. We still return the snapshot in-memory.
  }

  return snapshot;
}

/**
 * Read the stored attribution snapshot (does NOT capture). Use this from the
 * quote-submit handler — it pairs with captureLeadAttribution() running on
 * the landing page.
 */
export function getLeadAttribution(): LeadAttribution | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(LEAD_ATTRIBUTION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LeadAttribution;
  } catch {
    return null;
  }
}

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
