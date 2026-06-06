// src/app/api/messaging/messages/route.ts
// POST /api/messaging/messages — send a new message in a conversation

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClientSafe } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import type { SendMessageInput } from '@/types/messaging';

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (authUser.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const client = createServiceClientSafe();
  if (!client) return NextResponse.json({ error: 'Database unavailable' }, { status: 503 });

  let body: SendMessageInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { conversation_id, body: messageBody, channel = 'internal' } = body;
  if (!conversation_id || !messageBody?.trim()) {
    return NextResponse.json({ error: 'conversation_id and body are required' }, { status: 400 });
  }

  const validChannels = ['internal', 'sms', 'email'];
  if (!validChannels.includes(channel)) {
    return NextResponse.json({ error: `channel must be one of: ${validChannels.join(', ')}` }, { status: 400 });
  }

  // Verify the conversation exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conv, error: convErr } = await (client as any)
    .from('conversations')
    .select('id, status')
    .eq('id', conversation_id)
    .single();

  if (convErr || !conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }
  if (conv.status === 'archived') {
    return NextResponse.json({ error: 'Cannot send messages to an archived conversation' }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (client as any)
    .from('messages')
    .insert({
      conversation_id,
      sender_type: 'admin',
      sender_id: authUser.id,
      body: messageBody.trim(),
      channel,
      delivery_status: 'draft',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
