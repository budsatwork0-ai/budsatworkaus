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

function makeTableChain(rows: Row[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  let filtered = rows;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = { calls };
  for (const method of ['select', 'update'] as const) {
    chain[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return chain;
    };
  }
  chain.eq = (column: string, value: unknown) => {
    calls.push({ method: 'eq', args: [column, value] });
    filtered = filtered.filter((row) => row[column] === value);
    return chain;
  };
  chain.single = async () => ({ data: filtered[0] ?? null, error: null });
  chain.then = (onfulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: filtered, error: null }).then(onfulfilled);
  return chain;
}

function makeClient(rows: Row[]) {
  return { from: vi.fn(() => makeTableChain(rows)) };
}

function routeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

let sendMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SITE_URL = 'https://app.test';
  sendMock = vi.fn(async () => ({ data: { id: 'email-1' }, error: null }));
  getResendClient.mockReturnValue({ emails: { send: sendMock } });
});

describe('POST /api/quotes/[id]/remind', () => {
  it('forbids an employee from reminding on a sandbox quote', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ id: 'q1', status: 'finalized', payment_status: 'not_requested', customer_email: 'sarah@example.com', environment: 'sandbox' }])
    );
    const { POST } = await import('@/app/api/quotes/[id]/remind/route');

    const res = await POST(new Request('https://app.test/api/quotes/q1/remind', { method: 'POST' }) as never, routeParams('q1'));
    expect(res.status).toBe(403);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('allows an admin to remind on a sandbox quote but blocks the real email', async () => {
    getAuthUser.mockResolvedValue(ADMIN);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ id: 'q1', status: 'finalized', payment_status: 'not_requested', customer_email: 'sarah@example.com', environment: 'sandbox' }])
    );
    const { POST } = await import('@/app/api/quotes/[id]/remind/route');

    const res = await POST(new Request('https://app.test/api/quotes/q1/remind', { method: 'POST' }) as never, routeParams('q1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(sendMock).not.toHaveBeenCalled();
    expect(body).toEqual({ success: true, blocked: true, reason: 'sandbox' });
  });

  it('still allows an employee to remind on a production quote, and actually sends the email', async () => {
    getAuthUser.mockResolvedValue(EMPLOYEE);
    createServiceClientSafe.mockReturnValue(
      makeClient([{ id: 'q1', status: 'finalized', payment_status: 'not_requested', customer_email: 'sarah@example.com', environment: 'production' }])
    );
    const { POST } = await import('@/app/api/quotes/[id]/remind/route');

    const res = await POST(new Request('https://app.test/api/quotes/q1/remind', { method: 'POST' }) as never, routeParams('q1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: 'sarah@example.com' }));
    expect(body).toEqual({ success: true, sent_to: 'sarah@example.com' });
  });
});
