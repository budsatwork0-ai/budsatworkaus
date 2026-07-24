import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceClientSafe = vi.fn();

vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));

interface Row {
  [key: string]: unknown;
}

function makeClient(order: Row | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: order, error: order ? null : { message: 'not found' } }),
  };
  return { from: vi.fn(() => chain) };
}

function get(sessionId: string) {
  const url = `https://app.test/api/orders/by-session?session_id=${sessionId}`;
  return { nextUrl: new URL(url) } as never;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe('GET /api/orders/by-session', () => {
  it('returns production orders as before, unauthenticated', async () => {
    createServiceClientSafe.mockReturnValue(
      makeClient({
        id: 'o1',
        customer_name: 'Sarah',
        service_type: 'cleaning',
        context: 'home',
        final_price: 200,
        created_at: '2026-07-20T00:00:00.000Z',
        status: 'confirmed',
        scheduled_date: '2026-08-01',
        environment: 'production',
      })
    );
    const { GET } = await import('@/app/api/orders/by-session/route');

    const res = await GET(get('sess_1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe('o1');
    expect(body.customer_name).toBe('Sarah');
  });

  it('does not expose a sandbox order — returns the same 404 as a non-existent session', async () => {
    createServiceClientSafe.mockReturnValue(
      makeClient({
        id: 'o1',
        customer_name: 'Sandbox Person',
        service_type: 'cleaning',
        context: 'home',
        final_price: 200,
        created_at: '2026-07-20T00:00:00.000Z',
        status: 'confirmed',
        scheduled_date: '2026-08-01',
        environment: 'sandbox',
      })
    );
    const { GET } = await import('@/app/api/orders/by-session/route');

    const res = await GET(get('sess_sandbox'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Order not found');
    expect(JSON.stringify(body)).not.toContain('Sandbox Person');
  });

  it('returns an identical 404 body for a genuinely non-existent session', async () => {
    createServiceClientSafe.mockReturnValue(makeClient(null));
    const { GET } = await import('@/app/api/orders/by-session/route');

    const res = await GET(get('sess_missing'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Order not found');
  });
});
