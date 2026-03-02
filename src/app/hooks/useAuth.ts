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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsLoaded(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
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

    fetch('/api/users/me')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.role) setServerRole(resolveUserRole(data.role));
      })
      .catch(() => {})
      .finally(() => setServerRoleLoaded(true));
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
