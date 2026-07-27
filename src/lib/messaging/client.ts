// src/lib/messaging/client.ts
// Thin, framework-free wrappers around the /api/messaging/* endpoints.
//
// Shared by MessagingHub (drawer) and the full-page /dashboard/messages
// route so both surfaces hit the API the same way and surface errors the
// same way. `fetchImpl` is injectable so these are unit-testable without a
// browser (see tests/lib/messaging-client.test.ts).

import type {
  Conversation,
  ConversationStatus,
  CreateConversationInput,
  Message,
} from '@/types/messaging';

export type FetchImpl = typeof fetch;

async function parseJsonOrThrow(res: Response): Promise<unknown> {
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Unexpected response (status ${res.status})`);
  }
  if (!res.ok) {
    const message =
      typeof json === 'object' && json !== null && 'error' in json && typeof (json as { error?: unknown }).error === 'string'
        ? (json as { error: string }).error
        : `Request failed (status ${res.status})`;
    throw new Error(message);
  }
  return json;
}

export interface FetchConversationsParams {
  entity_type?: string;
  entity_id?: string;
  status?: ConversationStatus | 'all';
  limit?: number;
}

export async function fetchConversations(
  params: FetchConversationsParams = {},
  fetchImpl: FetchImpl = fetch,
): Promise<Conversation[]> {
  const search = new URLSearchParams();
  if (params.entity_type) search.set('entity_type', params.entity_type);
  if (params.entity_id) search.set('entity_id', params.entity_id);
  if (params.status) search.set('status', params.status);
  if (params.limit) search.set('limit', String(params.limit));

  const qs = search.toString();
  const res = await fetchImpl(`/api/messaging/conversations${qs ? `?${qs}` : ''}`);
  const json = await parseJsonOrThrow(res);
  return (json as { conversations?: Conversation[] }).conversations ?? [];
}

export async function fetchConversationThread(
  conversationId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<{ conversation: Conversation; messages: Message[] }> {
  const res = await fetchImpl(`/api/messaging/conversations/${conversationId}`);
  const json = await parseJsonOrThrow(res);
  const { conversation, messages } = json as { conversation: Conversation; messages?: Message[] };
  return { conversation, messages: messages ?? [] };
}

export async function createConversation(
  input: CreateConversationInput,
  fetchImpl: FetchImpl = fetch,
): Promise<Conversation> {
  const res = await fetchImpl('/api/messaging/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await parseJsonOrThrow(res);
  return (json as { conversation: Conversation }).conversation;
}

export async function sendMessage(
  conversationId: string,
  body: string,
  fetchImpl: FetchImpl = fetch,
): Promise<Message> {
  const res = await fetchImpl('/api/messaging/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId, body }),
  });
  const json = await parseJsonOrThrow(res);
  return (json as { message: Message }).message;
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
  fetchImpl: FetchImpl = fetch,
): Promise<Conversation> {
  const res = await fetchImpl(`/api/messaging/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  const json = await parseJsonOrThrow(res);
  return (json as { conversation: Conversation }).conversation;
}
