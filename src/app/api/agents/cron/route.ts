/**
 * GET /api/agents/cron?agent_id=...
 *
 * Triggered by Vercel Cron. Add entries to vercel.json (see AGENTS_README.md).
 * Auth: CRON_SECRET header / query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const provided = req.headers.get('authorization') ?? url.searchParams.get('secret');
  if (provided !== `Bearer ${process.env.CRON_SECRET}` && provided !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const agentId = url.searchParams.get('agent_id');
  if (!agentId) return NextResponse.json({ error: 'agent_id required' }, { status: 400 });

  try {
    const result = await runAgent({ agentId, trigger: 'cron' });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
