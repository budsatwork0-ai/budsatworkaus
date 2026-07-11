/**
 * GET /api/cron/bud
 *
 * Vercel Cron — activates Bud every 15 minutes.
 * Bud analyses all agent activity, derives lifecycle states,
 * and writes a new bud_lobby_state for Mission Control to render.
 *
 * Secured by CRON_SECRET env var.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { runAgent } from '@/lib/agents/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const result = await runAgent({ agentId: 'bud', trigger: 'cron' });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
