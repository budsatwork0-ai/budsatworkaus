/**
 * GET /api/memory/graph/[id]?depth=2
 *
 * Returns neighborhood subgraph around a single node.
 * Also accepts ?mode=neighborhood (default) or ?mode=decision
 * for decision context (ancestors, descendants, conflicts).
 *
 * Admin-only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { exportNeighborhoodVis } from '@/lib/memory/graph/visualize';
import { getNeighborhood, getDecisionChain } from '@/lib/memory/graph/traversal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id } = await params;
  const url   = new URL(req.url);
  const depth = Number(url.searchParams.get('depth') ?? '2');
  const mode  = url.searchParams.get('mode') ?? 'neighborhood';

  try {
    if (mode === 'decision') {
      const [neighborhood, chain] = await Promise.all([
        getNeighborhood(supabase, id, depth),
        getDecisionChain(supabase, id),
      ]);
      return NextResponse.json({ neighborhood, chain });
    }

    const graph = await exportNeighborhoodVis(supabase, id, depth);
    return NextResponse.json(graph);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
