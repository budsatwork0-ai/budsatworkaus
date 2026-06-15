/**
 * GET /api/sandbox/integrity
 *
 * Returns Agent Integrity Reports for the Bud Agent Doctor tab.
 * Runs server-side so the full agent registry (which imports Node.js modules)
 * never ends up in the client bundle.
 *
 * Admin-gated. Read-only. No DB access — pure static derivation.
 */
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { AGENT_LIST } from '@/lib/agents/registry';
import { deriveFleetIntegrityReports } from '@/app/(app)/dashboard/sandbox/_lib/doctor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agents = AGENT_LIST.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    category: a.category,
    autonomy: a.autonomy,
  }));

  const reports = deriveFleetIntegrityReports(agents);
  return NextResponse.json(reports);
}
