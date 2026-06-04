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
    .from('story_characters')
    .select('*')
    .order('name');

  if (error) {
    console.error('[api/story-characters] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch characters' }, { status: 500 });
  }

  return NextResponse.json({ characters: data ?? [] });
}
