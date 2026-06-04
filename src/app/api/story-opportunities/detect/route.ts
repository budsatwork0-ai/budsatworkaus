import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { runOpportunityDetection } from '@/lib/story-engine/detection';

// POST /api/story-opportunities/detect
// Runs all detection rules against real Bud OS data sources.
// Safe to call repeatedly — source_hash dedup prevents duplicate opportunities.
// Can also be triggered as a cron job via Vercel cron or /api/agents/cron.

export async function POST() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const summary = await runOpportunityDetection();

  return NextResponse.json(summary, {
    status: summary.errors.length > 0 && summary.created === 0 ? 500 : 200,
  });
}
