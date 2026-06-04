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
  const opportunityId = searchParams.get('opportunity_id') ?? '';

  if (!opportunityId) {
    return NextResponse.json({ error: 'opportunity_id is required' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('story_drafts')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/story-drafts] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
  }

  return NextResponse.json({ drafts: data ?? [] });
}
