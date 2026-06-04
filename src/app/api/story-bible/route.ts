import { NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('story_bible_sections')
    .select('*')
    .order('section_key');

  if (error) {
    console.error('[api/story-bible] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch story bible' }, { status: 500 });
  }

  return NextResponse.json({ sections: data ?? [] });
}
