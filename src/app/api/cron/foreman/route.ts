/**
 * GET /api/cron/foreman
 *
 * Vercel Cron — triggers The Foreman meta-agent on a schedule.
 * The Foreman analyses all agent activity, derives lifecycle states,
 * and writes a new lobby_state for the ForemanConsole to render.
 *
 * Secured by CRON_SECRET env var. Requires Vercel Pro for sub-hourly schedules.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAgent({ agentId: 'foreman', trigger: 'cron' });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
