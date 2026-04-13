'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resolveUserRole } from '@/types/roles';
import type { UserRole } from '@/types/roles';

// Single auth hook — combines user session + role resolution.
// Role priority:
//   1. JWT app_metadata.role  — set by service role, always trusted.
//   2. /api/users/me          — reads profiles table; covers window before JWT refreshes.
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverRole, setServerRole] = useState<UserRole | null>(null);
  const [serverRoleLoaded, setServerRoleLoaded] = useState(false);

  // Subscribe to auth state only — INITIAL_SESSION fires immediately with the
  // current session, so a separate getUser() call is redundant and causes a
  // double state-set on every mount.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoaded(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const jwtRole: UserRole | null = user?.app_metadata?.role
    ? resolveUserRole(user.app_metadata.role)
    : null;

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      setServerRoleLoaded(true);
      return;
    }

    if (user.app_metadata?.role) {
      setServerRoleLoaded(true);
      return;
    }

    // Fetch role from the profiles table with a 5-second timeout so a broken
    // API endpoint can never cause the hook to hang in an unresolved state.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    fetch('/api/users/me', { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role) setServerRole(resolveUserRole(data.role));
      })
      .catch(() => {
        // Silently fall back to 'customer' — resolved below via serverRoleLoaded
      })
      .finally(() => {
        clearTimeout(timeout);
        setServerRoleLoaded(true);
      });

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [user, isLoaded]);

  const role: UserRole = jwtRole ?? serverRole ?? 'customer';

  return {
    user,
    role,
    isLoaded: isLoaded && serverRoleLoaded,
    isAdmin: role === 'admin',
    isStaff: role === 'admin' || role === 'employee',
    isCustomer: role === 'customer',
  };
}
