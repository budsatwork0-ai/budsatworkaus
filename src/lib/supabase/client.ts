import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Browser-safe Supabase client using the anon key.
// Use this for client-side data fetching in React components.
export function createBrowserClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase browser credentials are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return createClient<Database>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

// Singleton instance for client-side usage
let browserClient: SupabaseClient<Database> | null = null;

// Get or create the browser Supabase client singleton.
// Use this in client components to avoid creating multiple instances.
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserClient should only be called on the client side.');
  }

  if (!browserClient) {
    browserClient = createBrowserClient();
  }
  return browserClient;
}

// Safe version that returns null instead of throwing if credentials are missing.
// Useful for optional database features or development without Supabase.
export function getSupabaseBrowserClientSafe(): SupabaseClient<Database> | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return getSupabaseBrowserClient();
  } catch {
    return null;
  }
}
