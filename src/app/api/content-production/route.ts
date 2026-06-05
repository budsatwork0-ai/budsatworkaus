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

async function requireApprovedScript(client: any, scriptId: string): Promise<boolean> {
  const { data, error } = await client
    .from('content_scripts')
    .select('id,status')
    .eq('id', scriptId)
    .single();
  return !error && data?.status === 'approved';
}

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { data, error } = await (client as any)
    .from('content_production_cards')
    .select('*')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api/content-production] GET:', error.message);
    return NextResponse.json({ error: 'Failed to fetch production cards' }, { status: 500 });
  }

  return NextResponse.json({ cards: data ?? [] });
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

  const scriptId = cleanText(body.script_id);
  const title = cleanText(body.title);
  if (!scriptId) return NextResponse.json({ error: 'script_id is required' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });

  if (!await requireApprovedScript(client as any, scriptId)) {
    return NextResponse.json({ error: 'Only approved scripts can create production cards' }, { status: 400 });
  }

  const insert = {
    script_id:           scriptId,
    title,
    platform:            cleanText(body.platform),
    format:              cleanText(body.format),
    related_arc_id:      cleanNullableText(body.related_arc_id),
    related_characters:  Array.isArray(body.related_characters) ? body.related_characters : [],
    deadline:            cleanNullableText(body.deadline),
    status:              body.status ?? 'to_film',
    notes:               cleanText(body.notes),
  };

  const { data, error } = await (client as any)
    .from('content_production_cards')
    .insert(insert)
    .select()
    .single();

  if (error) {
    console.error('[api/content-production] POST:', error.message);
    return NextResponse.json({ error: 'Failed to create production card' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
