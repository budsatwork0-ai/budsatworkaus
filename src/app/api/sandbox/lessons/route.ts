/**
 * GET /api/sandbox/lessons
 * Query params: agentId (optional), limit (optional, default 50)
 *
 * Returns lessons learned extracted from low-scoring sandbox runs.
 * Admin-gated. Read-only. Sandbox data only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSandboxLessons } from '@/lib/sandbox/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get('agentId') ?? undefined;
  const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : 50;

  try {
    const lessons = await getSandboxLessons({ agentId, limit });
    return NextResponse.json({ lessons, count: lessons.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
