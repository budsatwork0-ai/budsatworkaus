import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_scripts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/content-scripts] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content scripts' }, { status: 500 });
  }

  return NextResponse.json({ scripts: data ?? [] });
}

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

  const ideaId = cleanText(body.idea_id);
  if (!ideaId) return NextResponse.json({ error: 'idea_id is required' }, { status: 400 });

  const insert = {
    idea_id:     ideaId,
    hook:        cleanText(body.hook),
    setup:       cleanText(body.setup),
    core_moment: cleanText(body.core_moment),
    close_cta:   cleanText(body.close_cta),
    platform:    cleanText(body.platform),
    format:      cleanText(body.format),
    status:      body.status ?? 'draft',
    notes:       cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('content_scripts')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-scripts] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create content script' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
