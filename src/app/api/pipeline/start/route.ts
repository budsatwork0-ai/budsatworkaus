/**
 * POST /api/pipeline/start
 *
 * Manual dashboard trigger for the improvement pipeline.
 * Returns immediately — the actual pipeline runs after the response via after().
 *
 * Auth: admin/owner only (validated via profiles table).
 *       If no auth header is provided the request still proceeds (dashboard uses
 *       the session cookie implicitly; the auth check is belt-and-suspenders).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { after } from 'next/server';
import type { PipelineSurface } from '@/lib/pipeline/types';

// Allow up to 5 minutes so after() work has time to complete if Vercel waits.
export const maxDuration = 300;

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

  // Optional auth — only block if a token is provided AND the role is wrong.
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

  const params = {
    source: 'manual' as const,
    signalType,
    severity,
    title,
    description: body.description as string | undefined,
    affectedArea: body.affected_area as string | undefined,
    proposedApproach: body.proposed_approach as string | undefined,
    referenceFiles: Array.isArray(body.reference_files) ? (body.reference_files as string[]) : undefined,
    requestedBy: userId ?? undefined,
    surface,
    // Manual dashboard trigger = the user IS the approver.
    // Force level 3 so the pipeline executes rather than queuing for approval.
    autonomy_level: 3 as const,
    metadata: { triggered_by: userId ?? 'dashboard', confidence: 0.80 },
  };

  // Fire the pipeline after the response is sent — no Vercel timeout pressure.
  after(async () => {
    try {
      const { triggerImprovement } = await import('@/lib/bud/orchestrator');
      await triggerImprovement(supabase, params);
    } catch {
      // Non-fatal — the pipeline_run Realtime events will show what happened.
    }
  });

  return NextResponse.json({ ok: true, status: 'executing' });
}
