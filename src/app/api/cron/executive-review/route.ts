/**
 * GET /api/cron/executive-review
 *
 * Vercel Cron — daily executive review at 06:00 AEST.
 * Runs CEO → COO → CMO → CFO in sequence, then Chief of Staff.
 *
 * Secured by CRON_SECRET env var.
 *
 * Dry-run mode (?dry_run=1):
 *   Pulls real metrics, calls the LLM, but writes nothing to the DB.
 *   Returns proposed decisions and tasks as JSON. Use this to verify
 *   the executive layer before activating the cron schedule.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { runAgent } from '@/lib/agents/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ordered sequence: 4 functional execs first, then Chief of Staff routes the results.
const EXEC_SEQUENCE = ['ceo-agent', 'coo-agent', 'cmo-agent', 'cfo-agent', 'chief-of-staff'];

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const isDryRun = req.nextUrl.searchParams.get('dry_run') === '1';

  const results: Array<{
    agentId: string;
    status: string;
    summary?: string;
    output?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const agentId of EXEC_SEQUENCE) {
    try {
      const result = await runAgent({ agentId, trigger: 'cron', dryRun: isDryRun });
      results.push({
        agentId,
        status: 'ok',
        summary: typeof result?.summary === 'string' ? result.summary : undefined,
        ...(isDryRun && result?.output ? { output: result.output as Record<string, unknown> } : {}),
      });
    } catch (err) {
      results.push({
        agentId,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      // Don't abort — continue running remaining execs even if one fails.
    }
  }

  const failed = results.filter((r) => r.status === 'error');
  return NextResponse.json(
    {
      ...(isDryRun ? { dry_run: true } : {}),
      ran: results.length,
      failed: failed.length,
      results,
    },
    { status: failed.length === EXEC_SEQUENCE.length ? 500 : 200 },
  );
}
