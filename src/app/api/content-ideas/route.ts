import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { createServiceClientSafe } from '@/lib/supabase/server';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_ideas')
    .select('*')
    .order('priority')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/content-ideas] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch content ideas' }, { status: 500 });
  }

  return NextResponse.json({ ideas: data ?? [] });
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

  const title = cleanText(body.title);
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  const insert = {
    title,
    opportunity_id:      cleanNullableText(body.opportunity_id),
    related_arc_id:     cleanNullableText(body.related_arc_id),
    related_characters: Array.isArray(body.related_characters) ? body.related_characters : [],
    platform_fit:       cleanText(body.platform_fit),
    format:             cleanText(body.format),
    hook:               cleanText(body.hook),
    content_angle:      cleanText(body.content_angle),
    status:             body.status ?? 'captured',
    priority:           typeof body.priority === 'number' ? body.priority : 0,
    notes:              cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('content_ideas')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-ideas] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create content idea' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
