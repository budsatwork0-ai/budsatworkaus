import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthUser = vi.fn();
const createServiceClientSafe = vi.fn();
const getResendClient = vi.fn();

vi.mock('@/lib/auth', () => ({ getAuthUser }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClientSafe }));
vi.mock('@/lib/email/resend', () => ({ getResendClient, FROM_ADDRESS: 'admin@budsatwork.com' }));

const ADMIN = { id: 'admin-1', role: 'admin', email: 'admin@test.local' };
const EMPLOYEE = { id: 'employee-1', role: 'employee', email: 'employee@test.local' };

interface Row {
  [key: string]: unknown;
}

function makeClient(order: Row | null) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: order, error: order ? null : { message: 'not found' } }),
    update: () => ({ eq: () => ({ then: (cb: (v: unknown) => unknown) => Promise.resolve({}).then(cb) }) }),
  };
  return { from: vi.fn(() => chain) };
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post() {
  return new Request('https://app.test/api/orders/o1/remind-day-before', { method: 'POST' }) as never;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

const BASE_ORDER: Row = {
  id: 'o1',
  status: 'confirmed',
  customer_email: 'sarah@example.com',
  customer_name: 'Sarah',
  service_type: 'cleaning',
  scheduled_date: '2026-08-01',
  scheduled_time: '9am',
  notes: null,
  day_before_reminder_sent: false,
  job_assignments: [],
};

describe('POST /api/orders/[id]/remind-day-before', () => {
  it('preserves production reminder behaviour unchanged', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const send = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
    getResendClient.mockReturnValue({ emails: { send } });
    createServiceClientSafe.mockReturnValue(makeClient({ ...BASE_ORDER, environment: 'production' }));
    const { POST } = await import('@/app/api/orders/[id]/remind-day-before/route');

    const res = await POST(post(), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sent_to).toBe('sarah@example.com');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('blocks the real reminder email for a sandbox order and reports it clearly', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    const send = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
    getResendClient.mockReturnValue({ emails: { send } });
    createServiceClientSafe.mockReturnValue(makeClient({ ...BASE_ORDER, environment: 'sandbox' }));
    const { POST } = await import('@/app/api/orders/[id]/remind-day-before/route');

    const res = await POST(post(), routeParams('o1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.blocked).toBe(true);
    expect(body.reason).toBe('sandbox');
    expect(send).not.toHaveBeenCalled();
  });

  it('forbids an employee from reminding on a sandbox order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(makeClient({ ...BASE_ORDER, environment: 'sandbox' }));
    const { POST } = await import('@/app/api/orders/[id]/remind-day-before/route');

    const res = await POST(post(), routeParams('o1'));
    expect(res.status).toBe(403);
  });

  it('still allows an employee to remind on a production order', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    getResendClient.mockReturnValue({ emails: { send: vi.fn(async () => ({ data: { id: 'e1' }, error: null })) } });
    createServiceClientSafe.mockReturnValue(makeClient({ ...BASE_ORDER, environment: 'production' }));
    const { POST } = await import('@/app/api/orders/[id]/remind-day-before/route');

    const res = await POST(post(), routeParams('o1'));
    expect(res.status).toBe(200);
  });
});
