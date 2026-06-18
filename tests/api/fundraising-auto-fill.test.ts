import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getAuthUser: vi.fn(() => Promise.resolve({ id: 'admin_1', role: 'admin' })),
}));

function request(url: string) {
  return new Request('https://budsatwork.test/api/fundraising/auto-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }) as NextRequest;
}

describe('fundraising auto-fill route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(`
      <html>
        <head>
          <meta property="og:title" content="Commercial Ride-On Mower">
          <meta property="og:description" content="A sturdy mower for larger lawn care jobs.">
          <meta property="og:image" content="/mower.jpg">
        </head>
        <body><span>$1,899.00</span></body>
      </html>
    `, { status: 200 })));
  });

  it('extracts product metadata into editable draft item fields', async () => {
    const { POST } = await import('@/app/api/fundraising/auto-fill/route');
    const response = await POST(request('https://supplier.example/mowers/ride-on'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.item).toMatchObject({
      title: 'Commercial Ride-On Mower',
      status: 'draft',
      category: 'equipment',
      goal_amount_cents: 189_900,
      image_url: 'https://supplier.example/mower.jpg',
      supplier_url: 'https://supplier.example/mowers/ride-on',
    });
  });
});
