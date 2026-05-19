/**
 * POST /api/bud/investigate
 * Body: { runId: string, agentId: string, agentName?: string }
 *
 * Instructs Bud to investigate a specific agent run failure.
 * Creates a bud_task and (at level 2+) a GitHub issue.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { triggerInvestigation } from '@/lib/bud/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    runId?: string;
    agentId?: string;
    agentName?: string;
  };

  if (!body.runId || !body.agentId) {
    return NextResponse.json({ error: 'runId and agentId required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Resolve agent name if not provided
  let agentName = body.agentName;
  if (!agentName) {
    const { data: agent } = await supabase
      .from('agents')
      .select('name')
      .eq('id', body.agentId)
      .single();
    agentName = agent?.name ?? body.agentId;
  }

  try {
    const task = await triggerInvestigation(supabase, body.runId, body.agentId, agentName ?? body.agentId);
    return NextResponse.json({ task_id: task.id, status: task.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
