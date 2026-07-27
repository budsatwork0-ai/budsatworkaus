import { describe, expect, it, vi } from 'vitest';
import {
  fetchConversations,
  fetchConversationThread,
  sendMessage,
} from '@/lib/messaging/client';

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('fetchConversations', () => {
  it('returns the conversations array on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ conversations: [{ id: '1' }] }));
    const result = await fetchConversations({}, fetchImpl);
    expect(result).toEqual([{ id: '1' }]);
    expect(fetchImpl).toHaveBeenCalledWith('/api/messaging/conversations');
  });

  it('returns an empty array when the API returns no conversations key', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const result = await fetchConversations({}, fetchImpl);
    expect(result).toEqual([]);
  });

  it('returns an empty array when the conversations list is genuinely empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ conversations: [] }));
    const result = await fetchConversations({}, fetchImpl);
    expect(result).toEqual([]);
  });

  it('throws the server-provided error message on a non-ok response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403));
    await expect(fetchConversations({}, fetchImpl)).rejects.toThrow('Forbidden');
  });

  it('throws a fallback message on a non-ok response with no error body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchConversations({}, fetchImpl)).rejects.toThrow('Request failed (status 500)');
  });

  it('propagates a network-level rejection (fetch itself throwing)', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchConversations({}, fetchImpl)).rejects.toThrow('Failed to fetch');
  });

  it('surfaces a clear error when the response body is not valid JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    } as unknown as Response);
    await expect(fetchConversations({}, fetchImpl)).rejects.toThrow('Unexpected response (status 502)');
  });

  it('serializes filter params onto the query string', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ conversations: [] }));
    await fetchConversations({ entity_type: 'customer', entity_id: 'abc', status: 'open' }, fetchImpl);
    const calledUrl = fetchImpl.mock.calls[0][0] as string;
    expect(calledUrl).toContain('entity_type=customer');
    expect(calledUrl).toContain('entity_id=abc');
    expect(calledUrl).toContain('status=open');
  });
});

describe('fetchConversationThread', () => {
  it('returns the conversation and messages on success', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ conversation: { id: 'c1' }, messages: [{ id: 'm1' }] }),
    );
    const result = await fetchConversationThread('c1', fetchImpl);
    expect(result.conversation).toEqual({ id: 'c1' });
    expect(result.messages).toEqual([{ id: 'm1' }]);
  });

  it('defaults messages to an empty array when omitted', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ conversation: { id: 'c1' } }));
    const result = await fetchConversationThread('c1', fetchImpl);
    expect(result.messages).toEqual([]);
  });

  it('throws when the conversation is not found', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'Conversation not found' }, 404));
    await expect(fetchConversationThread('missing', fetchImpl)).rejects.toThrow('Conversation not found');
  });
});

describe('sendMessage', () => {
  it('posts the trimmed body and returns the created message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ message: { id: 'm2', body: 'hi' } }));
    const result = await sendMessage('c1', 'hi', fetchImpl);
    expect(result).toEqual({ id: 'm2', body: 'hi' });
    const [, init] = fetchImpl.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ conversation_id: 'c1', body: 'hi' });
  });

  it('throws on a failed send', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: 'Failed to send message' }, 500));
    await expect(sendMessage('c1', 'hi', fetchImpl)).rejects.toThrow('Failed to send message');
  });
});
