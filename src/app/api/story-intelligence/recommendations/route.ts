import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/artifacts/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { buildStoryIntelligenceRecommendations } from '@/lib/story-intelligence/recommendations';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  try {
    const response = await buildStoryIntelligenceRecommendations(client as any);
    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/story-intelligence/recommendations] GET:', error);
    return NextResponse.json({ error: 'Failed to build Story Intelligence recommendations' }, { status: 500 });
  }
}
