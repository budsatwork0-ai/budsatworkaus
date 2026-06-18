import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const items = [
    {
      id: 'item_live',
      title: 'Live mower',
      slug: 'live-mower',
      status: 'live',
      goal_amount_cents: 10_000,
      raised_amount_cents: 0,
      manual_adjustment_cents: 0,
    },
    {
      id: 'item_draft',
      title: 'Draft tool',
      slug: 'draft-tool',
      status: 'draft',
      goal_amount_cents: 5_000,
      raised_amount_cents: 0,
      manual_adjustment_cents: 0,
    },
  ];
  const contributions = [
    { fundraising_item_id: 'item_live', amount_cents: 2_000, status: 'paid' },
    { fundraising_item_id: 'item_live', amount_cents: 5_000, status: 'refunded' },
  ];

  const serviceClient = {
    from: vi.fn((table: string) => {
      const builder = {
        select: vi.fn(() => builder),
        eq: vi.fn((column: string, value: string) => {
          if (table === 'fundraising_items' && column === 'status') {
            builder.data = items.filter((item) => item.status === value);
          }
          return builder;
        }),
        in: vi.fn((_column: string, values: string[]) => {
          if (table === 'fundraising_items') {
            builder.data = items.filter((item) => values.includes(item.status));
          }
          if (table === 'fundraising_contributions') {
            builder.data = contributions;
          }
          return builder;
        }),
        order: vi.fn(() => Promise.resolve({ data: builder.data ?? items, error: null })),
        data: undefined as unknown,
      };
      return builder;
    }),
  };

  return { serviceClient };
});

vi.mock('@/lib/supabase/server', () => ({
  createServiceClientSafe: vi.fn(() => mocks.serviceClient),
}));

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(() => Promise.resolve({ id: 'admin_1', role: 'admin' })),
}));

describe('fundraising routes', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.serviceClient.from.mockClear();
  });

  it('public API excludes draft items and returns calculated paid totals', async () => {
    const { GET } = await import('@/app/api/fundraising/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: 'item_live',
      raised_amount_cents: 2_000,
      contribution_count: 1,
      remaining_amount_cents: 8_000,
    });
  });
});
