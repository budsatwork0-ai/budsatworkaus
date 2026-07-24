import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { withWorkspaceContext } from '@/lib/workspace/context';
import { createWorkspaceRepository } from '@/lib/workspace/repository';

interface EqCall {
  column: string;
  value: unknown;
}

function fakeClient(row: Record<string, unknown> | null) {
  const eqCalls: EqCall[] = [];
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push({ column, value });
      return chain;
    }),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  const client = { from: vi.fn(() => chain) };
  return { client: client as unknown as SupabaseClient<Database>, eqCalls };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createWorkspaceRepository', () => {
  it('binds the client and workspace once, at creation time', () => {
    const { client } = fakeClient(null);
    const repo = createWorkspaceRepository('customers', { client, workspace: 'sandbox' });
    expect(repo.table).toBe('customers');
    expect(repo.client).toBe(client);
    expect(repo.workspace).toBe('sandbox');
  });

  it('falls back to the ambient workspace when none is supplied explicitly', async () => {
    const { client } = fakeClient(null);
    const repo = await withWorkspaceContext('sandbox', async () =>
      createWorkspaceRepository('customers', { client })
    );
    expect(repo.workspace).toBe('sandbox');
  });

  it('scope() applies the workspace filter to an arbitrary caller-built query', () => {
    const { client } = fakeClient(null);
    const repo = createWorkspaceRepository('customers', { client, workspace: 'production' });
    const calls: EqCall[] = [];
    const query = {
      eq(column: 'environment', value: 'production' | 'sandbox') {
        calls.push({ column, value });
        return query;
      },
    };
    repo.scope(query);
    expect(calls).toEqual([{ column: 'environment', value: 'production' }]);
  });

  it('stamp() stamps a write payload with the bound workspace', () => {
    const { client } = fakeClient(null);
    const repo = createWorkspaceRepository('customers', { client, workspace: 'sandbox' });
    expect(repo.stamp({ full_name: 'Sarah Thompson' })).toEqual({
      full_name: 'Sarah Thompson',
      environment: 'sandbox',
    });
  });

  it('getById() filters by id and by the bound workspace', async () => {
    const row = { id: 'abc-123', full_name: 'Sarah Thompson' };
    const { client, eqCalls } = fakeClient(row);
    const repo = createWorkspaceRepository('customers', { client, workspace: 'sandbox' });

    const result = await repo.getById('abc-123');

    expect(result.data).toEqual(row);
    expect(eqCalls).toEqual([
      { column: 'id', value: 'abc-123' },
      { column: 'environment', value: 'sandbox' },
    ]);
  });

  it('throws a clear error when no client is injected and none can be constructed', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(() => createWorkspaceRepository('customers')).toThrow(/Supabase service client is unavailable/);
  });
});
