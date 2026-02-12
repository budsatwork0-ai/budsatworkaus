import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Server-only Supabase client using the service role key.
// This bypasses RLS and should only be used in API routes and server actions.
export function createServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase service credentials are missing. ' +
      'Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.'
    );
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Safe version that returns null instead of throwing.
// Useful for graceful degradation when database is unavailable.
export function createServiceClientSafe(): SupabaseClient<Database> | null {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}
