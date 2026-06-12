/**
 * POST /api/sandbox/replay
 * Body: { trainingRunId: string }
 *
 * Re-executes the scenario from an existing training run.
 * Useful for comparing agent behaviour before/after a prompt change.
 * Admin-gated. No production side effects.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { replaySandboxRun } from '@/lib/sandbox/arena';
import { SANDBOX_SCENARIOS } from '@/lib/sandbox/scenarios';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as { trainingRunId?: string };
  if (!body.trainingRunId) {
    return NextResponse.json({ error: 'trainingRunId required' }, { status: 400 });
  }

  try {
    const result = await replaySandboxRun(body.trainingRunId, SANDBOX_SCENARIOS, {
      triggeredBy: user.id,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
