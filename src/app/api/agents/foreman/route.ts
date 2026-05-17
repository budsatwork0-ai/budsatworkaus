/**
 * POST /api/agents/foreman
 *
 * Manually triggers The Foreman meta-agent from the ForemanConsole.
 * Admin-only (checked via Supabase session cookie).
 * No body required.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runAgent } from '@/lib/agents/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  try {
    const result = await runAgent({ agentId: 'foreman', trigger: 'manual' });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
