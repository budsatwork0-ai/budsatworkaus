// src/app/api/messaging/conversations/route.ts
// GET  /api/messaging/conversations           — list conversations (with filters)
// POST /api/messaging/conversations           — create a new conversation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { CreateConversationInput } from '@/types/messaging';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const entity_type = searchParams.get('entity_type');
  const entity_id   = searchParams.get('entity_id');
  const status      = searchParams.get('status') || 'open';
  const limit       = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client as any)
    .from('conversations')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (entity_type) query = query.eq('entity_type', entity_type);
  if (entity_id)   query = query.eq('entity_id', entity_id);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conversations = data || [];

  // Enrich each conversation with the last message preview
  if (conversations.length > 0) {
    const ids: string[] = conversations.map((c: { id: string }) => c.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: latestMsgs } = await (client as any)
      .from('messages')
      .select('conversation_id, body, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false });

    const latestByConv: Record<string, string> = {};
    for (const msg of (latestMsgs || []) as Array<{ conversation_id: string; body: string }>) {
      if (!latestByConv[msg.conversation_id]) {
        latestByConv[msg.conversation_id] = msg.body;
      }
    }

    for (const conv of conversations) {
      conv.last_message = latestByConv[conv.id] ?? null;
    }
  }

  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: CreateConversationInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { entity_type, entity_id, subject } = body;
  if (!entity_type || !entity_id) {
    return NextResponse.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
  }

  const validTypes = ['customer', 'crew', 'lead', 'applicant'];
  if (!validTypes.includes(entity_type)) {
    return NextResponse.json({ error: `entity_type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('conversations')
    .insert({
      entity_type,
      entity_id,
      subject: subject || null,
      created_by: authUser.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data }, { status: 201 });
}
