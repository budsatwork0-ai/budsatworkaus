import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  // Return active chapter first, then all others for history
  const { data, error } = await (client as any)
    .from('story_chapters')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/story-chapter] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch chapters' }, { status: 500 });
  }

  const chapters = data ?? [];
  const active = chapters.find((c: { is_active: boolean }) => c.is_active) ?? null;

  return NextResponse.json({ active, chapters });
}
