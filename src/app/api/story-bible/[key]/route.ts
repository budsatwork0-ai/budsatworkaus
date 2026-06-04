import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

const VALID_KEYS = [
  'mission_purpose',
  'core_tension',
  'narrative_tone',
  'what_we_show',
  'what_we_never_do',
  'the_long_arc',
  'current_narrative_notes',
] as const;

type RouteParams = { params: Promise<{ key: string }> };

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { key } = await params;

  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  if (!(VALID_KEYS as readonly string[]).includes(key)) {
    return NextResponse.json({ error: 'Unknown section key' }, { status: 400 });
  }

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: { content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body.content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const { data, error } = await (client as any)
    .from('story_bible_sections')
    .update({ content: body.content, updated_by: 'Jackson Taylor' })
    .eq('section_key', key)
    .select()
    .single();

  if (error) {
    console.error('[api/story-bible/[key]] PUT:', error.message);
    return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
  }

  return NextResponse.json(data);
}
