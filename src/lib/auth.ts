import { createAuthServerClient } from '@/lib/supabase/server-client';
import { resolveUserRole } from '@/types/roles';

// Shared server-side auth helper for API routes.
// Returns the authenticated user's id, role, and email, or null if not signed in.
export async function getAuthUser() {
  const supabase = await createAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let role = resolveUserRole(user.app_metadata?.role);
  if (!user.app_metadata?.role) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    role = resolveUserRole(profile?.role);
  }

  return {
    id: user.id,
    role,
    email: user.email,
  };
}
