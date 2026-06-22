import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/artifacts/server';
import { analyzeContentFeedback } from '@/lib/content-feedback/engine';
import { createServiceClientSafe } from '@/lib/supabase/server';

const analyzeSchema = z.object({
  campaign_factory_run_id: z.string().uuid().optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  artifact_ids: z.array(z.string().uuid()).optional().default([]),
}).refine((value) =>
  Boolean(value.campaign_factory_run_id || value.campaign_id || value.artifact_ids.length > 0),
  'Provide campaign_factory_run_id, campaign_id, or artifact_ids',
);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: z.infer<typeof analyzeSchema>;
  try {
    parsed = analyzeSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const analyzed = await analyzeContentFeedback({
    client: client as any,
    campaignFactoryRunId: parsed.campaign_factory_run_id,
    campaignId: parsed.campaign_id,
    artifactIds: parsed.artifact_ids,
    createdBy: auth.authUser.id,
  });

  if ('error' in analyzed) {
    console.error('[api/content-feedback/analyze] POST:', analyzed.error.message);
    return NextResponse.json({ error: 'Failed to analyze campaign feedback' }, { status: 500 });
  }

  return NextResponse.json(analyzed, { status: 201 });
}
