'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const IDLE_MS = 45_000; // 45 seconds

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

/**
 * Signs the user out after IDLE_MS of inactivity, or immediately when the
 * page becomes hidden (tab switched, minimised, or navigated away from).
 */
export function useIdleSignOut() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const signOut = async () => {
      await supabase.auth.signOut();
      window.location.href = '/account';
    };

    const resetTimer = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(signOut, IDLE_MS);
    };

    const onVisibilityChange = () => {
      if (document.hidden) signOut();
    };

    // Start the idle clock immediately.
    resetTimer();

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}
