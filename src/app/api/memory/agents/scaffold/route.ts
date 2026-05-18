/**
 * POST /api/memory/agents/scaffold
 *
 * Creates (or repairs) all 7 agent workspace folders in the Obsidian vault.
 * Idempotent — safe to run multiple times. Existing README files are preserved.
 *
 * Admin-only.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { scaffoldAllWorkspaces, getWorkspace } from '@/lib/memory/agents/workspace';
import { WORKSPACES } from '@/lib/memory/agents/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );
  const { data: { session } } = await supabaseAuth.auth.getSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  if (!process.env.OBSIDIAN_VAULT_PATH) {
    return NextResponse.json({ error: 'OBSIDIAN_VAULT_PATH not configured' }, { status: 500 });
  }

  try {
    scaffoldAllWorkspaces();
    return NextResponse.json({
      ok: true,
      workspaces: WORKSPACES.map((w) => ({ id: w.id, folder: w.folder })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
