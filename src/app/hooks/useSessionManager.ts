'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

// Idle thresholds (ms of real inactivity, not counting time tab is hidden)
const WARN_AT_MS        = 9  * 60_000;  // 9 min  → show warning
const SOFT_LOCK_AT_MS   = 10 * 60_000;  // 10 min → soft lock
const FULL_LOGOUT_AT_MS = 30 * 60_000;  // 30 min → full sign-out

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
 * Timeline (real inactivity, paused while tab is hidden):
 *   0 → 9 min  : active
 *   9 → 10 min : warning modal (countdown)
 *   10 → 30 min: soft locked (progress preserved, re-auth required)
 *   30 min+    : full sign-out → redirect /account
 *
 * Tab hidden → timer pauses. Tab visible → timer resumes from where it left off.
 */
export function useSessionManager(): UseSessionManagerReturn {
  const [sessionState, setSessionState] = useState<SessionState>('active');
  const [user, setUser] = useState<User | null>(null);

  // Tracks real idle time (not counting hidden-tab duration)
  const lastActivityRef  = useRef<number>(Date.now());
  const pausedMsRef      = useRef<number>(0);
  const tabHiddenAtRef   = useRef<number | null>(null);
  const tickRef          = useRef<ReturnType<typeof setInterval> | null>(null);

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
    lastActivityRef.current = Date.now();
    pausedMsRef.current = 0;
    tabHiddenAtRef.current = null;
    setSessionState('active');
  }, []);

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

  // ── Idle tick + visibility pause ─────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const doFullLogout = async () => {
      setSessionState('logged_out');
      await supabase.auth.signOut();
      window.location.href = '/account';
    };

    const resetActivity = () => {
      // Only reset if in active or warning state (don't let activity dismiss soft lock)
      setSessionState((prev) => {
        if (prev === 'active' || prev === 'warning') {
          lastActivityRef.current = Date.now();
          pausedMsRef.current = 0;
          return 'active';
        }
        return prev;
      });
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden — record when we hid
        tabHiddenAtRef.current = Date.now();
      } else {
        // Tab visible — accumulate the hidden duration
        if (tabHiddenAtRef.current !== null) {
          pausedMsRef.current += Date.now() - tabHiddenAtRef.current;
          tabHiddenAtRef.current = null;
        }
      }
    };

    const tick = () => {
      // If tab is currently hidden, don't advance the idle clock
      if (document.hidden) return;

      const realIdle = Date.now() - lastActivityRef.current - pausedMsRef.current;

      setSessionState((prev) => {
        if (prev === 'logged_out') return prev;
        if (prev === 'soft_locked') {
          // In soft lock: still track for full logout
          if (realIdle >= FULL_LOGOUT_AT_MS) {
            doFullLogout();
            return 'logged_out';
          }
          return prev;
        }
        if (realIdle >= FULL_LOGOUT_AT_MS) {
          doFullLogout();
          return 'logged_out';
        }
        if (realIdle >= SOFT_LOCK_AT_MS) return 'soft_locked';
        if (realIdle >= WARN_AT_MS)      return 'warning';
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
  }, []);

  return { sessionState, user, extendSession, unlock };
}
