import { createAuthServerClient } from '@/lib/supabase/server-client';
import { resolveUserRole } from '@/types/roles';

// Shared server-side auth helper for API routes.
// Returns the authenticated user's id, role, and email, or null if not signed in.
export async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Always read role from the profiles table so that admin-applied role
  // changes take effect immediately rather than waiting for JWT expiry.
  // JWT app_metadata is used only as a fallback if the profiles row is absent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = resolveUserRole(profile?.role ?? user.app_metadata?.role);

  return {
    id: user.id,
    role,
    email: user.email,
  };
}
