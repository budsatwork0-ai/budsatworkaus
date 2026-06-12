/**
 * GET /api/sandbox/leaderboard
 *
 * Returns per-agent aggregate scores (avg F1, precision, recall, hit rate,
 * cost) sorted by avg F1 descending.
 * Admin-gated. Read-only. Sandbox data only.
 */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSandboxLeaderboard } from '@/lib/sandbox/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const rows = await getSandboxLeaderboard();
    return NextResponse.json({ leaderboard: rows, count: rows.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
