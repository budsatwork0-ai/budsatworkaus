/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MessagesPage from '@/app/(app)/dashboard/messages/page';

const CONVERSATIONS = [
  {
    id: 'conv-1',
    entity_type: 'customer',
    entity_id: 'cust-1',
    entity_display_name: 'Jane Smith',
    subject: null,
    status: 'open',
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    last_message: 'See you Thursday',
  },
  {
    id: 'conv-2',
    entity_type: 'crew',
    entity_id: 'crew-1',
    entity_display_name: 'Alex Crew',
    subject: null,
    status: 'open',
    created_by: null,
    created_at: '2026-01-02T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    last_message: 'On my way',
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function mockFetchRouter(handlers: {
  conversations?: () => Response | Promise<Response>;
  thread?: (id: string) => Response | Promise<Response>;
}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.startsWith('/api/messaging/conversations/') && method === 'GET') {
      const id = url.split('/').pop() as string;
      if (handlers.thread) return handlers.thread(id);
      return jsonResponse({ conversation: CONVERSATIONS[0], messages: [] });
    }
    if (url.startsWith('/api/messaging/conversations') && method === 'GET') {
      if (handlers.conversations) return handlers.conversations();
      return jsonResponse({ conversations: CONVERSATIONS });
    }
    throw new Error(`Unhandled request in test: ${method} ${url}`);
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetchRouter({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MessagesPage — initial load', () => {
  it('resolves out of the opening state once the conversation list loads', async () => {
    render(<MessagesPage />);
    expect(screen.getByText(/opening messages/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText(/opening messages/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Alex Crew')).toBeInTheDocument();
  });

  it('shows a valid empty state, not a permanent loader, when there are no conversations', async () => {
    vi.stubGlobal('fetch', mockFetchRouter({ conversations: () => jsonResponse({ conversations: [] }) }));
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.queryByText(/opening messages/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
    expect(screen.queryByText(/opening messages/i)).not.toBeInTheDocument();
  });

  it('shows an error state with a retry action when the list request fails, and clears loading', async () => {
    const fetchImpl = mockFetchRouter({ conversations: () => jsonResponse({ error: 'Forbidden' }, 403) });
    vi.stubGlobal('fetch', fetchImpl);
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText(/couldn.t load conversations/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/opening messages/i)).not.toBeInTheDocument();
    expect(screen.getByText('Forbidden')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /retry/i });
    vi.stubGlobal('fetch', mockFetchRouter({}));
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('does not get stuck opening even when fetch itself rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<MessagesPage />);

    await waitFor(() => {
      expect(screen.getByText(/couldn.t load conversations/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/opening messages/i)).not.toBeInTheDocument();
  });
});

describe('MessagesPage — selection', () => {
  it('shows the "select a conversation" empty state when nothing is selected, not a loader', async () => {
    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());

    expect(screen.getByText('Select a conversation to view messages.')).toBeInTheDocument();
  });

  it('opens a conversation on click and renders its thread', async () => {
    vi.stubGlobal('fetch', mockFetchRouter({
      thread: () => jsonResponse({
        conversation: CONVERSATIONS[0],
        messages: [{ id: 'm1', conversation_id: 'conv-1', sender_type: 'entity', sender_id: null, body: 'Hi there', channel: 'internal', delivery_status: 'sent', created_at: '2026-01-01T00:00:00.000Z' }],
      }),
    }));
    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Jane Smith'));

    await waitFor(() => {
      expect(screen.getByText('Hi there')).toBeInTheDocument();
    });
    expect(screen.queryByText('Select a conversation to view messages.')).not.toBeInTheDocument();
  });

  it('shows a thread-level error with retry when the thread request fails, without blowing away the list', async () => {
    vi.stubGlobal('fetch', mockFetchRouter({ thread: () => jsonResponse({ error: 'Conversation not found' }, 404) }));
    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Jane Smith'));

    await waitFor(() => {
      expect(screen.getByText(/couldn.t load this conversation/i)).toBeInTheDocument();
    });
    // The list itself must still be intact — a failed thread fetch is not a page-level failure.
    expect(screen.getByText('Alex Crew')).toBeInTheDocument();
  });

  it('a slow/never-resolving thread request cannot keep the page in the opening state', async () => {
    vi.stubGlobal('fetch', mockFetchRouter({ thread: () => new Promise<Response>(() => {}) }));
    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Jane Smith'));

    // The page-level view already resolved before selection ever happened;
    // a hung secondary (thread) request must not resurrect the opening view.
    expect(screen.queryByText(/^opening messages/i)).not.toBeInTheDocument();
  });
});

describe('MessagesPage — responsive panes', () => {
  it('keeps the list pane reachable on desktop even once a conversation is selected', async () => {
    render(<MessagesPage />);
    await waitFor(() => expect(screen.getByText('Jane Smith')).toBeInTheDocument());

    const listItem = screen.getByText('Jane Smith').closest('button') as HTMLElement;
    fireEvent.click(listItem);

    await waitFor(() => expect(screen.queryByText('Select a conversation to view messages.')).not.toBeInTheDocument());

    const listPane = screen.getByPlaceholderText('Search conversations').closest('div.flex.flex-col, div.hidden') as HTMLElement;
    expect(listPane?.className).toContain('md:flex');
  });
});
