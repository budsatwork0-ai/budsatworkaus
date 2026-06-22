import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/artifacts/server';
import { createServiceClientSafe } from '@/lib/supabase/server';

type RouteParams = { params: Promise<{ id: string }> };

const reviewSchema = z.object({
  status: z.enum(['approved', 'rejected']).optional().default('approved'),
  review_note: z.string().trim().optional(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let parsed: z.infer<typeof reviewSchema>;
  try {
    parsed = reviewSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request body' }, { status: 400 });
  }

  const reviewedAt = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: parsed.status,
    reviewed_by: auth.authUser.id,
    reviewed_at: reviewedAt,
  };
  if (parsed.review_note) update.confidence_reason = parsed.review_note;

  const { data: learningRecord, error } = await (client as any)
    .from('content_learning_records')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Learning record not found' }, { status: 404 });
    console.error('[api/content-feedback/[id]/approve] update:', error.message);
    return NextResponse.json({ error: 'Failed to review learning record' }, { status: 500 });
  }

  if (learningRecord.learning_artifact_id) {
    const artifactStatus = parsed.status === 'approved' ? 'approved' : 'rejected';
    const { error: artifactError } = await (client as any)
      .from('artifacts')
      .update({
        status: artifactStatus,
        approved_by: parsed.status === 'approved' ? auth.authUser.id : null,
        approved_at: parsed.status === 'approved' ? reviewedAt : null,
      })
      .eq('id', learningRecord.learning_artifact_id);

    if (artifactError) {
      console.error('[api/content-feedback/[id]/approve] artifact:', artifactError.message);
    }
  }

  return NextResponse.json({ learning_record: learningRecord });
}
