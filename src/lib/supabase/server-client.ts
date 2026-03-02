import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

// User-scoped server client for API routes and server components.
// Reads auth session from cookies and respects RLS.
// For admin operations that bypass RLS, use createServiceClient() from server.ts instead.
export async function createAuthServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll can fail when called from a Server Component (read-only cookies).
            // This is fine — the middleware will refresh the session.
          }
        },
      },
    },
  );
}
