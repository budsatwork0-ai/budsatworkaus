/**
 * POST /api/memory/sync
 *
 * Triggers a full or partial vault → Supabase sync.
 * Admin-only.
 *
 * Body (optional JSON):
 *   { category?: MemoryCategory; forceReembed?: boolean }
 *
 * Returns SyncStats.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { syncVault, exportAgentMemories } from '@/lib/memory/sync';
import type { MemoryCategory } from '@/lib/memory/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min — embedding large vaults is slow

export async function POST(req: NextRequest) {
  // Auth: must be admin
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: { category?: MemoryCategory; forceReembed?: boolean; exportPending?: boolean } = {};
  try { body = await req.json(); } catch { /* no body */ }

  try {
    const [syncStats, exportResult] = await Promise.all([
      syncVault({
        category:     body.category,
        forceReembed: body.forceReembed ?? false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supabase:     supabaseAdmin as any,
      }),
      body.exportPending !== false
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? exportAgentMemories({ supabase: supabaseAdmin as any })
        : Promise.resolve({ exported: 0, errors: [] }),
    ]);

    return NextResponse.json({ sync: syncStats, export: exportResult });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
