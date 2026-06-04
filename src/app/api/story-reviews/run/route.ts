import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { evaluateDraft } from '@/lib/story/review-engine';
import type { StoryDraft } from '@/types/story-engine';

export async function POST(req: NextRequest) {
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

  const draftId = typeof body.draft_id === 'string' ? body.draft_id.trim() : '';
  if (!draftId) {
    return NextResponse.json({ error: 'draft_id is required' }, { status: 400 });
  }

  // Fetch draft
  const { data: draft, error: draftErr } = await (client as any)
    .from('story_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (draftErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
  }

  // Run deterministic review engine
  const result = evaluateDraft(draft as StoryDraft);

  // Persist review — store findings JSON in reviewer_notes
  const reviewRow = {
    draft_id:                 draftId,
    review_status:            'pending_review' as const,
    safety_score:             result.safety_score,
    consent_verified:         result.consent_verified,
    privacy_checked:          result.privacy_checked,
    factual_accuracy_checked: result.factual_accuracy_checked,
    brand_alignment_checked:  result.brand_alignment_checked,
    findings:                 result.findings,
    reviewer_notes:           '',
    reviewed_by:              null,
    reviewed_at:              null,
  };

  const { data: review, error: insertErr } = await (client as any)
    .from('story_reviews')
    .insert(reviewRow)
    .select()
    .single();

  if (insertErr) {
    console.error('[api/story-reviews/run] Insert error:', insertErr.message);
    return NextResponse.json({ error: 'Failed to save review' }, { status: 500 });
  }

  // Audit log — fire and forget
  await (client as any).from('audit_log').insert([{
    entity_type: 'story_review',
    entity_id:   review.id,
    action:      'safety_review_run',
    new_value:   { draft_id: draftId, safety_score: result.safety_score, recommendation: result.recommendation },
    source:      'admin',
  }]).then(() => {}).catch(() => {});

  // Build recommended_changes from blocker/warning findings
  const recommended_changes = result.findings
    .filter((f) => f.severity === 'blocker' || f.severity === 'warning')
    .map((f) => `[${f.category.toUpperCase()}] ${f.message}`);

  return NextResponse.json({ review, findings: result.findings, recommended_changes }, { status: 201 });
}
