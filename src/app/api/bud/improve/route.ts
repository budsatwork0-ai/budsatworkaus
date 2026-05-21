/**
 * POST /api/bud/improve
 *
 * Manually trigger the autonomous improvement pipeline for a specific signal
 * or create a new signal on the fly.
 *
 * Body (trigger existing signal):
 *   { signalId: string }
 *
 * Body (create new signal and run):
 *   {
 *     source: string,
 *     signalType: string,
 *     severity: string,
 *     title: string,
 *     description?: string,
 *     affectedArea?: string,
 *     proposedApproach?: string,
 *     referenceFiles?: string[]
 *   }
 *
 * GET /api/bud/improve
 *   Returns recent improvement signals and their execution status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/auth';
import { triggerImprovement } from '@/lib/bud/orchestrator';
import { executeImprovementPipeline } from '@/lib/bud/improvement-executor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();

  const body = (await req.json()) as {
    signalId?: string;
    source?: string;
    signalType?: string;
    severity?: string;
    title?: string;
    description?: string;
    affectedArea?: string;
    proposedApproach?: string;
    referenceFiles?: string[];
  };

  try {
    // ── Path 1: run pipeline for an existing signal ───────────────────────────
    if (body.signalId) {
      const result = await executeImprovementPipeline(supabase, {
        signalId: body.signalId,
        userId: user.id,
        trigger: 'manual',
      });
      return NextResponse.json(result);
    }

    // ── Path 2: create a new signal + trigger ─────────────────────────────────
    if (!body.signalType || !body.title) {
      return NextResponse.json(
        { error: 'signalId OR (signalType + title) required' },
        { status: 400 },
      );
    }

    const result = await triggerImprovement(supabase, {
      source: body.source ?? 'manual',
      signalType: body.signalType,
      severity: body.severity ?? 'medium',
      title: body.title,
      description: body.description,
      affectedArea: body.affectedArea,
      proposedApproach: body.proposedApproach,
      referenceFiles: body.referenceFiles,
      requestedBy: user.id,
    });

    return NextResponse.json(result);

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || !['admin', 'owner'].includes(user.role)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabase = adminClient();

  const [{ data: signals }, { data: executions }] = await Promise.all([
    supabase
      .from('bud_improvement_signals')
      .select('id, source, signal_type, severity, title, affected_area, status, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('bud_improvement_executions')
      .select('id, signal_id, title, status, pr_url, branch_name, auto_merged, confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  return NextResponse.json({ signals: signals ?? [], executions: executions ?? [] });
}
