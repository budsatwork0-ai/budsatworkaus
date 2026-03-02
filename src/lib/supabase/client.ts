import { createBrowserClient as createSSRBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Singleton instance for client-side usage
let browserClient: SupabaseClient<Database> | null = null;

// Get or create the browser Supabase client singleton.
// Uses @supabase/ssr for cookie-based auth session handling.
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserClient should only be called on the client side.');
  }

  if (!browserClient) {
    browserClient = createSSRBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}

// Safe version that returns null instead of throwing if credentials are missing.
export function getSupabaseBrowserClientSafe(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') return null;
  try {
    return getSupabaseBrowserClient();
  } catch {
    return null;
  }
}
