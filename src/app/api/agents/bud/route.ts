/**
 * POST /api/agents/bud
 *
 * Manually activates Bud from Mission Control or the BudConsole.
 * Admin-only. No body required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/runtime';
import { getAuthUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await runAgent({ agentId: 'bud', trigger: 'manual', triggeredBy: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
