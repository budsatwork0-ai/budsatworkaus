/**
 * GET /api/health/bud-observer
 *
 * Returns structured JSON that external monitors can parse:
 *
 *   200 { status: 'healthy' }           — all sources succeeded
 *   200 { status: 'degraded', ... }     — ≥1 source failed but observer ran
 *   503 { status: 'outage', ... }       — all sources failed / agent threw
 *
 * Using 200 for 'degraded' ensures monitors can distinguish
 * 'observer crashed' (connection error / non-200) from 'observer degraded'
 * (200 with status:'degraded') from 'observer healthy' (200 with status:'healthy').
 */

import { NextResponse } from 'next/server';
import { runBudObserver } from '@/agents/bud-observer';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const report = await runBudObserver();

    if (!report.ok) {
      // All sources failed — full outage
      return NextResponse.json(
        {
          status: 'outage',
          partial: report.partial,
          degradedSources: report.degradedSources,
          runAt: report.runAt,
        },
        { status: 503 },
      );
    }

    if (report.partial) {
      // Some sources failed — degraded but not down
      return NextResponse.json(
        {
          status: 'degraded',
          partial: true,
          degradedSources: report.degradedSources,
          runAt: report.runAt,
        },
        { status: 200 },
      );
    }

    // All sources succeeded
    return NextResponse.json(
      {
        status: 'healthy',
        partial: false,
        degradedSources: [],
        runAt: report.runAt,
      },
      { status: 200 },
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        level: 'error',
        agent: 'bud-observer',
        message: 'Observer route unhandled error',
        error: message,
      }),
    );
    return NextResponse.json(
      {
        status: 'outage',
        partial: false,
        degradedSources: [],
        error: message,
        runAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
