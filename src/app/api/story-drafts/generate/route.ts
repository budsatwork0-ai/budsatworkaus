import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { generateDraftForOpportunity } from '@/lib/story/draft-generator';

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
  const format        = typeof body.format === 'string' ? body.format.trim() : '';
  const platform      = typeof body.platform === 'string' ? body.platform.trim() : '';

  if (!opportunityId) return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 });
  if (!format)        return NextResponse.json({ error: 'format is required' }, { status: 400 });
  if (!platform)      return NextResponse.json({ error: 'platform is required' }, { status: 400 });

  try {
    const { draft, consentWarnings } = await generateDraftForOpportunity(
      client as any,
      opportunityId,
      format,
      platform,
      apiKey,
    );
    return NextResponse.json({ ...draft, consent_warnings: consentWarnings }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg === 'Opportunity not found') {
      return NextResponse.json({ error: 'Opportunity not found' }, { status: 404 });
    }
    if (msg.startsWith('Anthropic error')) {
      console.error('[story-drafts/generate]', msg);
      return NextResponse.json({ error: 'AI generation failed. Please try again.' }, { status: 502 });
    }
    if (msg.startsWith('Unexpected shape') || msg.startsWith('Failed to save')) {
      console.error('[story-drafts/generate]', msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    console.error('[story-drafts/generate] unexpected:', msg);
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}
