/**
 * GET /api/sandbox/readiness
 *
 * Returns fleet readiness: overall percentage of scenarios where the most
 * recent run achieved f1 >= 0.5, plus a per-category breakdown.
 * Admin-gated. Read-only. Sandbox data only.
 */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getSandboxReadiness } from '@/lib/sandbox/arena';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const readiness = await getSandboxReadiness();
    return NextResponse.json(readiness);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
