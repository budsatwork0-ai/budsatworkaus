import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { StoryReviewStatus } from '@/types/story-review';

const TERMINAL_STATUSES: StoryReviewStatus[] = ['approved', 'rejected'];

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.review_status === 'string') {
    // Guard: approved status requires all four safety booleans to be true
    if (body.review_status === 'approved') {
      const { data: current, error: fetchErr } = await (client as any)
        .from('story_reviews')
        .select('privacy_checked, consent_verified, factual_accuracy_checked, brand_alignment_checked')
        .eq('id', id)
        .single();
      if (fetchErr || !current) {
        return NextResponse.json({ error: 'Review not found' }, { status: 404 });
      }
      if (
        !current.privacy_checked ||
        !current.consent_verified ||
        !current.factual_accuracy_checked ||
        !current.brand_alignment_checked
      ) {
        return NextResponse.json(
          { error: 'Cannot approve: one or more safety checks have not passed. Re-run the safety review to resolve findings first.' },
          { status: 422 },
        );
      }
    }

    update.review_status = body.review_status;
    // Stamp reviewer identity when a terminal decision is made
    if (TERMINAL_STATUSES.includes(body.review_status as StoryReviewStatus)) {
      update.reviewed_by  = authUser.id ?? null;
      update.reviewed_at  = new Date().toISOString();
    }
  }

  if (typeof body.reviewer_notes === 'string') {
    update.reviewer_notes = body.reviewer_notes;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { data: updated, error } = await (client as any)
    .from('story_reviews')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    console.error('[api/story-reviews/[id]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }

  // Audit log for status changes — fire and forget
  if (typeof body.review_status === 'string') {
    await (client as any).from('audit_log').insert([{
      entity_type: 'story_review',
      entity_id:   id,
      action:      `review_status_${body.review_status}`,
      new_value:   { review_status: body.review_status },
      source:      'admin',
    }]).then(() => {}).catch(() => {});
  }

  return NextResponse.json(updated);
}
