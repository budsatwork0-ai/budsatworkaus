/**
 * GET /api/cron/sandbox-runner?pack=hourly|daily|full
 *
 * Vercel Cron — continuous Agent Training Arena sweeps (Phase 1 step 6).
 *   hourly : customer/quote scenarios          (0 * * * *)
 *   daily  : ops / finance / ndis / growth     (0 3 * * *)
 *   full   : full regression, every category   (30 1 * * *)
 *
 * Sandbox-only by construction: execution goes through the arena interceptor,
 * which captures proposed actions and never dispatches emails, Stripe, Twilio,
 * or production writes. Spend capped by sandbox_policy.max_daily_cost_cents.
 *
 * Secured by CRON_SECRET (same pattern as the other cron routes).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { runSandboxScenario } from '@/lib/sandbox/arena';
import { runCronPack } from '@/lib/sandbox/runner';
import type { CronPack } from '@/lib/sandbox/runner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const VALID_PACKS: CronPack[] = ['hourly', 'daily', 'full'];

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  const pack = req.nextUrl.searchParams.get('pack') as CronPack | null;
  if (!pack || !VALID_PACKS.includes(pack)) {
    return NextResponse.json(
      { error: `pack must be one of: ${VALID_PACKS.join(', ')}` },
      { status: 400 },
    );
  }

  const supabase = createServiceClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });
  }

  try {
    const report = await runCronPack(pack, {
      supabase,
      runScenario: runSandboxScenario,
    });
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
