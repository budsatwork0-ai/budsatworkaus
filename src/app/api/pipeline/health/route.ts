/**
 * GET /api/pipeline/health
 *
 * Runs the pipeline health-check and returns a 200 (healthy) or 200
 * with warnings (degraded). Intentionally always returns 200 so
 * uptime monitors don't alarm — warnings are surfaced in the JSON body
 * and in server logs. This endpoint can be called by a cron job or
 * monitoring tool.
 */
import { NextResponse } from 'next/server';
import { checkPipelineHealth } from '@/lib/pipeline/health-check';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await checkPipelineHealth();
    return NextResponse.json({ status: 'ok', checkedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn('[pipeline-health route] Unexpected error during health check:', message);
    return NextResponse.json(
      { status: 'error', message, checkedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
