/**
 * GET /api/memory/search?q=...&category=...&limit=5&threshold=0.7
 *
 * Semantic search across the memory vault.
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { searchMemory } from '@/lib/memory/search';
import type { MemoryCategory } from '@/lib/memory/types';
import { MEMORY_CATEGORIES } from '@/lib/memory/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Auth
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
    .from('profiles').select('role').eq('id', session.user.id).single();
  if (!profile || !['admin', 'owner'].includes(profile.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const url       = new URL(req.url);
  const query     = url.searchParams.get('q') ?? '';
  const catParam  = url.searchParams.get('category');
  const limit     = Number(url.searchParams.get('limit') ?? '5');
  const threshold = Number(url.searchParams.get('threshold') ?? '0.7');
  const stale     = url.searchParams.get('stale') === 'true';

  if (!query.trim()) {
    return NextResponse.json({ error: 'q parameter required' }, { status: 400 });
  }

  const category = catParam && MEMORY_CATEGORIES.includes(catParam as MemoryCategory)
    ? (catParam as MemoryCategory)
    : undefined;

  try {
    const results = await searchMemory(
      query,
      { category, limit, threshold, includeStale: stale },
      { supabase: supabaseAdmin },
    );
    return NextResponse.json({ query, results, count: results.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
