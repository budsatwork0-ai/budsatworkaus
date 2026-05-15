/**
 * POST /api/agents/run
 * Body: { agent_id: string, input?: object }
 *
 * Triggers an agent run. Requires admin auth.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/runtime';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { agent_id?: string; input?: Record<string, unknown> };
  if (!body.agent_id) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  try {
    const result = await runAgent({
      agentId: body.agent_id,
      trigger: 'manual',
      triggeredBy: user.id,
      input: body.input ?? {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
