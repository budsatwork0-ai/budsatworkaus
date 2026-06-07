import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { generateDraftForOpportunity } from '@/lib/story/draft-generator';
import type { StoryDraft } from '@/types/story-engine';

// The three auto-suggest combos produced after Quick Capture.
// Format/platform values must match SUGGESTED_FORMATS / SUGGESTED_PLATFORMS in types/story-engine.ts.
const SUGGEST_COMBOS = [
  { format: 'Photo post', platform: 'Facebook'  },
  { format: 'Reel',       platform: 'Instagram' },
  { format: 'Photo post', platform: 'LinkedIn'  },
] as const;

const SCORE_THRESHOLD = 60;

/**
 * POST /api/story-drafts/suggest
 *
 * Generates up to 3 draft suggestions for a scored opportunity:
 *   Facebook photo post · Instagram Reel · LinkedIn photo post
 *
 * Guards:
 *   • story_score must be >= 60 (returns 422 otherwise)
 *   • Skips any combo where a draft already exists (no duplicates)
 *   • Respects consent gates and what_to_protect (via generateDraftForOpportunity)
 *   • Never quotes raw journal text (enforced in prompt)
 *   • Does not auto-publish — all drafts land in status='draft' for human review
 *
 * Body: { opportunity_id: string }
 * Returns: { created: StoryDraft[]; skipped: string[]; consent_warnings: string[] }
 */
export async function POST(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY ?? '';
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Draft generation is not available — ANTHROPIC_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const opportunityId = typeof body.opportunity_id === 'string' ? body.opportunity_id.trim() : '';
  if (!opportunityId) return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 });

  // ── Verify opportunity exists and meets score threshold ─────────────────────
  const { data: opp, error: oppErr } = await (client as any)
    .from('story_opportunities')
    .select('id, story_score, status')
    .eq('id', opportunityId)
    .single();

  if (oppErr || !opp) return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });

  if (opp.story_score === null || opp.story_score < SCORE_THRESHOLD) {
    return NextResponse.json(
      { error: `story_score is ${opp.story_score ?? 'unscored'} — minimum ${SCORE_THRESHOLD} required for draft suggestions` },
      { status: 422 },
    );
  }

  // ── Find which combos already have a draft (duplicate guard) ────────────────
  const { data: existingDrafts } = await (client as any)
    .from('story_drafts')
    .select('format, platform')
    .eq('opportunity_id', opportunityId);

  const existingKeys = new Set(
    (existingDrafts ?? []).map((d: { format: string; platform: string }) => `${d.format}::${d.platform}`),
  );

  // ── Generate missing combos ─────────────────────────────────────────────────
  const created: StoryDraft[] = [];
  const skipped: string[] = [];
  const allConsentWarnings: string[] = [];

  for (const combo of SUGGEST_COMBOS) {
    const key = `${combo.format}::${combo.platform}`;

    if (existingKeys.has(key)) {
      skipped.push(`${combo.format} / ${combo.platform}`);
      continue;
    }

    try {
      const { draft, consentWarnings } = await generateDraftForOpportunity(
        client as any,
        opportunityId,
        combo.format,
        combo.platform,
        apiKey,
      );
      created.push(draft);
      allConsentWarnings.push(...consentWarnings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      console.error(`[api/story-drafts/suggest] ${combo.format}/${combo.platform}:`, msg);
      // Continue generating remaining combos even if one fails.
      skipped.push(`${combo.format} / ${combo.platform} (error: ${msg.slice(0, 80)})`);
    }
  }

  return NextResponse.json(
    {
      created,
      skipped,
      consent_warnings: [...new Set(allConsentWarnings)],
    },
    { status: created.length > 0 ? 201 : 200 },
  );
}
