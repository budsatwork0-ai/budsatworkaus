/**
 * GET /api/agents/runs?agent_id=...&limit=50
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const agentId = url.searchParams.get('agent_id');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 50), 200);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let q = supabase
    .from('agent_runs')
    .select('id, agent_id, status, summary, cost_cents, duration_ms, started_at, finished_at, trigger')
    .order('started_at', { ascending: false })
    .limit(limit);
  if (agentId) q = q.eq('agent_id', agentId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ runs: data });
}
