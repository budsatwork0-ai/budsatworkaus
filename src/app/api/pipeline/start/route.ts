/**
 * POST /api/pipeline/start
 *
 * Creates a real improvement signal and fires the pipeline for it.
 * The pipeline_run is created synchronously and its ID is returned
 * immediately; stage progress is visible via Realtime in the dashboard.
 *
 * Body:
 *   surface       — PipelineSurface (optional, auto-detected from affected_area)
 *   signal_type   — e.g. 'ux_friction' | 'performance' | 'conversion_drop'
 *   severity      — 'low' | 'medium' | 'high' | 'critical'
 *   title         — concise description of the opportunity
 *   description   — optional detail
 *   affected_area — page path or area (used to infer surface)
 *   proposed_approach — optional improvement suggestion
 *   reference_files   — optional file paths
 *
 * Auth: admin/owner only (validated via profiles table).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PipelineSurface } from '@/lib/pipeline/types';

const VALID_SURFACES: PipelineSurface[] = ['public', 'admin', 'crew', 'customer'];
const VALID_SIGNAL_TYPES = [
  'ux_friction', 'design_debt', 'agent_quality', 'performance',
  'conversion_drop', 'error_spike', 'manual',
] as const;
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Auth: only admin/owner may trigger real runs
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  let userId: string | null = null;
  if (token) {
    const { data: { user } } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ).auth.getUser(token);
    userId = user?.id ?? null;
  }

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', userId).single();
    if (!profile || !['admin', 'owner'].includes(profile.role as string)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const signalType = VALID_SIGNAL_TYPES.includes(body.signal_type as typeof VALID_SIGNAL_TYPES[number])
    ? (body.signal_type as string)
    : 'manual';
  const severity = VALID_SEVERITIES.includes(body.severity as typeof VALID_SEVERITIES[number])
    ? (body.severity as string)
    : 'medium';
  const title = (body.title as string | undefined)?.trim();
  const surface = VALID_SURFACES.includes(body.surface as PipelineSurface)
    ? (body.surface as PipelineSurface)
    : undefined;

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const { triggerImprovement } = await import('@/lib/bud/orchestrator');

  const result = await triggerImprovement(supabase, {
    source: 'manual',
    signalType,
    severity,
    title,
    description: body.description as string | undefined,
    affectedArea: body.affected_area as string | undefined,
    proposedApproach: body.proposed_approach as string | undefined,
    referenceFiles: Array.isArray(body.reference_files)
      ? (body.reference_files as string[])
      : undefined,
    metadata: { triggered_by: userId ?? 'anonymous', confidence: 0.80 },
    requestedBy: userId ?? undefined,
    surface,
  });

  return NextResponse.json({
    ok: true,
    signal_id: result.signalId,
    pipeline_run_id: result.pipelineRunId ?? null,
    status: result.status,
  });
}
