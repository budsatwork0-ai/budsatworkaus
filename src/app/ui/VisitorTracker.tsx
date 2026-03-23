'use client';

// Lightweight tracker injected into the root layout.
// Fires pageview events on route changes and heartbeats every 30s.
// Excluded from admin/crew/portal routes — only tracks the public marketing site.

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const EXCLUDED_PREFIXES = ['/dashboard', '/crew', '/portal', '/api', '/account'];
const HEARTBEAT_INTERVAL_MS = 30_000;
const SESSION_KEY = '_baw_sid';

function shouldTrack(path: string): boolean {
  return !EXCLUDED_PREFIXES.some(prefix => path.startsWith(prefix));
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const id = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, id);
  return id;
}

export default function VisitorTracker() {
  // Initialize in useEffect so it always runs on the client, never during SSR.
  // useState lazy initializers can receive the server-rendered '' value during
  // hydration, which causes the !sessionId guard to silently bail out.
  const [sessionId, setSessionId] = useState('');
  // Gate tracking on first real user interaction — headless bots execute JS but
  // don't scroll, click, or type, so this reliably filters automated traffic.
  const [hasInteracted, setHasInteracted] = useState(false);
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    const onInteract = () => setHasInteracted(true);
    const events = ['scroll', 'click', 'keydown', 'mousemove', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, onInteract, { once: true, passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, onInteract));
  }, []);

  // Track page views on route change
  useEffect(() => {
    if (!sessionId || !pathname || !shouldTrack(pathname)) return;
    if (!hasInteracted) return;
    if (lastTrackedPath.current === pathname) return;
    lastTrackedPath.current = pathname;

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        page: pathname,
        page_title: document.title,
        referrer: document.referrer || undefined,
        event_type: 'pageview',
      }),
      keepalive: true,
    }).catch(() => {});
  }, [pathname, sessionId, hasInteracted]);

  // Heartbeat — keeps session alive, updates current page
  useEffect(() => {
    if (!sessionId || !hasInteracted) return;

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
  }, [sessionId]);

  return null;
}
