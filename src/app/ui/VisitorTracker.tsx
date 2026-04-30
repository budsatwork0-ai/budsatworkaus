'use client';

// Enhanced visitor tracker — injected into the root layout.
// Tracks: pageviews, heartbeats, scroll depth, time on page, UTM params,
// new vs returning visitors, and CTA click events via [data-track] attributes.
// Excluded from admin/crew/portal routes — only tracks the public marketing site.
// Pageviews fire on first load so brief visits persist in analytics history.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  getOrCreatePublicAnalyticsSessionId,
  trackPublicAnalyticsEvent,
} from '@/lib/analytics/public';
import {
  PUBLIC_ANALYTICS_RETURNING_KEY,
} from '@/lib/analytics/shared';

const EXCLUDED_PREFIXES = ['/dashboard', '/crew', '/portal', '/api', '/account'];
const HEARTBEAT_INTERVAL_MS = 30_000;
const COOKIE_CONSENT_KEY = 'cookie-consent';

function shouldTrack(path: string): boolean {
  return !EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix));
}

function getOrCreateSessionId(): { id: string; isNew: boolean } {
  if (typeof window === 'undefined') return { id: '', isNew: false };
  const stored = getOrCreatePublicAnalyticsSessionId();
  if (stored) return { id: stored, isNew: false };
  return { id: '', isNew: true };
}

function isReturningVisitor(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(PUBLIC_ANALYTICS_RETURNING_KEY) === '1';
}

function markAsReturning(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PUBLIC_ANALYTICS_RETURNING_KEY, '1');
}

function getUtmParams(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const val = params.get(key);
    if (val) result[key] = val;
  }
  return result;
}

function getMaxScrollDepth(): number {
  const scrolled = window.scrollY + window.innerHeight;
  const total = document.documentElement.scrollHeight;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((scrolled / total) * 100));
}

export default function VisitorTracker() {
  const [sessionId, setSessionId] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const pathname = usePathname();

  const lastTrackedPath = useRef<string | null>(null);
  const pageEntryTime = useRef<number>(Date.now());
  const maxScrollDepth = useRef<number>(0);
  const utmParams = useRef<Record<string, string>>({});
  const isFirstPageview = useRef<boolean>(true);

  // Initialise session on mount (client-only)
  useEffect(() => {
    const syncConsent = () => {
      const accepted = localStorage.getItem(COOKIE_CONSENT_KEY) === 'accepted';
      setHasConsent(accepted);
      if (!accepted) setSessionId('');
    };

    syncConsent();
    window.addEventListener('cookie-consent-change', syncConsent);
    return () => window.removeEventListener('cookie-consent-change', syncConsent);
  }, []);

  // Initialise session after analytics consent (client-only)
  useEffect(() => {
    if (!hasConsent) return;
    const { id, isNew } = getOrCreateSessionId();
    const returning = isReturningVisitor();
    setSessionId(id);
    setIsReturning(returning);
    // Capture UTM params once on mount
    utmParams.current = getUtmParams();
    // Mark as returning on next visit
    if (isNew) markAsReturning();
  }, [hasConsent]);

  // Track scroll depth continuously
  useEffect(() => {
    const onScroll = () => {
      const depth = getMaxScrollDepth();
      if (depth > maxScrollDepth.current) {
        maxScrollDepth.current = depth;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Track page views on route change, sending previous page's engagement data
  useEffect(() => {
    if (!hasConsent || !sessionId || !pathname || !shouldTrack(pathname)) return;
    if (lastTrackedPath.current === pathname) return;

    const previousPath = lastTrackedPath.current;
    const timeOnPrevPage = previousPath
      ? Math.round((Date.now() - pageEntryTime.current) / 1000)
      : 0;
    const scrollOnPrevPage = maxScrollDepth.current;

    // Reset for new page
    pageEntryTime.current = Date.now();
    maxScrollDepth.current = getMaxScrollDepth();
    lastTrackedPath.current = pathname;

    const payload: Record<string, unknown> = {
      session_id: sessionId,
      page: pathname,
      page_title: document.title,
      referrer: document.referrer || undefined,
      event_type: 'pageview',
      is_returning: isReturning,
      // UTM params (only sent on first pageview to keep payload light)
      ...(isFirstPageview.current ? utmParams.current : {}),
      // Engagement data for the page the visitor just LEFT
      ...(previousPath && timeOnPrevPage > 0
        ? { prev_page: previousPath, prev_time_on_page: timeOnPrevPage, prev_scroll_depth: scrollOnPrevPage }
        : {}),
    };

    isFirstPageview.current = false;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }, [hasConsent, pathname, sessionId, isReturning]);

  // Send final page engagement data when tab closes / user navigates away
  useEffect(() => {
    if (!hasConsent || !sessionId) return;

    const flush = () => {
      const currentPath = window.location.pathname;
      if (!shouldTrack(currentPath)) return;
      const timeOnPage = Math.round((Date.now() - pageEntryTime.current) / 1000);
      if (timeOnPage < 2) return; // ignore instant bounces
      navigator.sendBeacon(
        '/api/track',
        JSON.stringify({
          session_id: sessionId,
          page: currentPath,
          page_title: document.title,
          event_type: 'engagement',
          time_on_page: timeOnPage,
          scroll_depth: maxScrollDepth.current,
        })
      );
    };

    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });

    return () => {
      window.removeEventListener('beforeunload', flush);
    };
  }, [hasConsent, sessionId]);

  // Heartbeat — keeps session alive and updates current page
  useEffect(() => {
    if (!hasConsent || !sessionId) return;

    const interval = setInterval(() => {
      const currentPath = window.location.pathname;
      if (!shouldTrack(currentPath)) return;

      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          page: currentPath,
          page_title: document.title,
          event_type: 'heartbeat',
        }),
        keepalive: true,
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [hasConsent, sessionId]);

  // CTA click tracking — attach to any element with [data-track="event-name"]
  // Example: <button data-track="quote_request" data-track-label="Get a Quote">
  useEffect(() => {
    if (!hasConsent || !sessionId) return;

    const onClick = (e: MouseEvent) => {
      const target = (e.target as Element)?.closest('[data-track],[data-tracking-name]') as HTMLElement | null;
      if (!target) return;
      const eventName = target.dataset.track ?? target.dataset.trackingName;
      if (!eventName) return;
      const eventLabel = target.dataset.trackLabel ?? target.textContent?.trim().slice(0, 60) ?? undefined;
      const eventData = target.dataset.trackValue
        ? { value: target.dataset.trackValue }
        : undefined;

      void trackPublicAnalyticsEvent({
        eventName,
        eventLabel,
        eventData,
      });
    };

    document.addEventListener('click', onClick, { passive: true });
    return () => document.removeEventListener('click', onClick);
  }, [hasConsent, sessionId]);

  return null;
}
