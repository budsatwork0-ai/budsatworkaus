'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Auth sessions should not remain usable after someone walks away.
// Five minutes is intentionally short for shared/admin devices.
const WARN_AT_MS = 4 * 60_000;
const FULL_LOGOUT_AT_MS = 5 * 60_000;
const LAST_ACTIVITY_KEY = 'budsatwork.auth.lastActivityAt';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
  'click',
] as const;

export type SessionState = 'active' | 'warning' | 'soft_locked' | 'logged_out';

export interface UseSessionManagerReturn {
  sessionState: SessionState;
  user: User | null;
  extendSession: () => void;
  unlock: (password: string) => Promise<{ error: string | null }>;
}

/**
 * Manages session idle state for protected portals.
 *
 * Timeline:
 *   0 → 4 min : active
 *   4 → 5 min : warning modal
 *   5 min+    : full sign-out → redirect /account
 *
 * Hidden/closed tabs count as inactivity. The timestamp is persisted so a
 * browser sleep, reload, or return days later cannot revive an old profile.
 */
export function useSessionManager(): UseSessionManagerReturn {
  const [sessionState, setSessionState] = useState<SessionState>('active');
  const [user, setUser] = useState<User | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logoutInFlightRef = useRef(false);

  const persistActivity = useCallback((at: number) => {
    lastActivityRef.current = at;
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  }, []);

  // ── Auth subscription ────────────────────────────────────────────────────
  // onAuthStateChange fires INITIAL_SESSION immediately, so getUser() is redundant.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Extend (reset timer back to active) ─────────────────────────────────
  const extendSession = useCallback(() => {
    persistActivity(Date.now());
    setSessionState('active');
  }, [persistActivity]);

  // ── Unlock (re-auth with password) ──────────────────────────────────────
  const unlock = useCallback(async (password: string): Promise<{ error: string | null }> => {
    if (!user?.email) return { error: 'Session not found. Please sign in again.' };
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (error) {
      return { error: 'Incorrect password. Please try again.' };
    }
    extendSession();
    return { error: null };
  }, [user, extendSession]);

  // ── Idle tick + hidden-tab expiry ────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const doFullLogout = async () => {
      if (logoutInFlightRef.current) return;
      logoutInFlightRef.current = true;
      setSessionState('logged_out');
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
      await supabase.auth.signOut();
      window.location.href = '/account';
    };

    const storedLastActivity = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    if (Number.isFinite(storedLastActivity) && storedLastActivity > 0) {
      lastActivityRef.current = storedLastActivity;
      if (Date.now() - storedLastActivity >= FULL_LOGOUT_AT_MS) {
        void doFullLogout();
      }
    } else {
      persistActivity(Date.now());
    }

    const resetActivity = () => {
      // Only reset if in active or warning state.
      setSessionState((prev) => {
        if (prev === 'active' || prev === 'warning') {
          persistActivity(Date.now());
          return 'active';
        }
        return prev;
      });
    };

    const onVisibilityChange = () => {
      if (!document.hidden && Date.now() - lastActivityRef.current >= FULL_LOGOUT_AT_MS) {
        void doFullLogout();
      }
    };

    const tick = () => {
      const realIdle = Date.now() - lastActivityRef.current;

      setSessionState((prev) => {
        if (prev === 'logged_out') return prev;
        if (realIdle >= FULL_LOGOUT_AT_MS) {
          void doFullLogout();
          return 'logged_out';
        }
        if (realIdle >= WARN_AT_MS) return 'warning';
        return 'active';
      });
    };

    tickRef.current = setInterval(tick, 1_000);

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, resetActivity));
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [persistActivity]);

  return { sessionState, user, extendSession, unlock };
}
