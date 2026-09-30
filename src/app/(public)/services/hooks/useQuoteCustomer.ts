'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { Action, WizardState } from '../types';

export function useQuoteCustomer(state: WizardState, dispatch: Dispatch<Action>) {
  const [user, setUser] = useState<User | null>(null);
  const [profileHydrated, setProfileHydrated] = useState(false);
  const contact = useRef({ fullName: state.fullName, email: state.email, phone: state.phone });
  useEffect(() => {
    contact.current = { fullName: state.fullName, email: state.email, phone: state.phone };
  }, [state.fullName, state.email, state.phone]);

  useEffect(() => {
    const { data: { subscription } } = getSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      // No Supabase calls inside the callback; async auth calls can deadlock.
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setProfileHydrated(false);
    if (!user) return;
    const prefill = (profile: { full_name?: string; email?: string; phone?: string }) => {
      const current = contact.current;
      const extra: Partial<WizardState> = {};
      if (!current.fullName.trim() && profile.full_name) extra.fullName = profile.full_name;
      if (!current.email.trim() && profile.email) extra.email = profile.email;
      if (!current.phone.trim() && profile.phone) extra.phone = profile.phone;
      if (Object.keys(extra).length) dispatch({ type: 'merge', value: extra });
    };
    prefill({ full_name: user.user_metadata?.full_name, email: user.email, phone: user.phone });
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    fetch('/api/portal/profile', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data?.profile) prefill(data.profile); })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeout);
        if (!cancelled) setProfileHydrated(true);
      });
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  // Entering contact after restoring a draft must hydrate any blank fields again.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, state.step, dispatch]);

  return { user, profileHydrated };
}
