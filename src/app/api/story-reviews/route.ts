import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const draftId = searchParams.get('draft_id') ?? '';

  if (!draftId) {
    return NextResponse.json({ error: 'draft_id is required' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('story_reviews')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/story-reviews] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }

  return NextResponse.json({ reviews: data ?? [] });
}
