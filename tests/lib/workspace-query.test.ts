import { describe, expect, it } from 'vitest';
import { withWorkspaceContext } from '@/lib/workspace/context';
import {
  WorkspaceMismatchError,
  assertWorkspaceCompatibility,
  scopeQuery,
  stampWorkspace,
  type WorkspaceScopable,
} from '@/lib/workspace/query';
import type { Workspace } from '@/lib/workspace/types';

interface FakeQuery extends WorkspaceScopable<FakeQuery> {
  calls: Array<{ column: 'environment'; value: Workspace }>;
}

function fakeQuery(): FakeQuery {
  const calls: FakeQuery['calls'] = [];
  const query: FakeQuery = {
    calls,
    eq(column, value) {
      calls.push({ column, value });
      return query;
    },
  };
  return query;
}

describe('scopeQuery', () => {
  it('applies the environment column filter for an explicit workspace', () => {
    const query = fakeQuery();
    const result = scopeQuery(query, 'sandbox');
    expect(result).toBe(query);
    expect(query.calls).toEqual([{ column: 'environment', value: 'sandbox' }]);
  });

  it('defaults to the ambient workspace when none is passed', async () => {
    const query = fakeQuery();
    await withWorkspaceContext('sandbox', async () => {
      scopeQuery(query);
    });
    expect(query.calls).toEqual([{ column: 'environment', value: 'sandbox' }]);
  });
});

describe('stampWorkspace', () => {
  it('stamps a plain record with the given workspace', () => {
    const stamped = stampWorkspace({ full_name: 'Sarah Thompson' }, 'sandbox');
    expect(stamped).toEqual({ full_name: 'Sarah Thompson', environment: 'sandbox' });
  });

  it('cannot be overridden by a conflicting environment value already on the record', () => {
    const stamped = stampWorkspace({ full_name: 'Sarah Thompson', environment: 'production' }, 'sandbox');
    expect(stamped.environment).toBe('sandbox');
    expect(Object.keys(stamped).filter((k) => k === 'environment')).toHaveLength(1);
  });

  it('defaults to the ambient workspace when none is passed', async () => {
    const stamped = await withWorkspaceContext('sandbox', async () => stampWorkspace({ full_name: 'Sarah' }));
    expect(stamped.environment).toBe('sandbox');
  });
});

describe('assertWorkspaceCompatibility', () => {
  it('does not throw when both sides match, whether raw values or scoped records', () => {
    expect(() => assertWorkspaceCompatibility('production', 'production')).not.toThrow();
    expect(() => assertWorkspaceCompatibility({ environment: 'sandbox' }, 'sandbox')).not.toThrow();
  });

  it('throws a WorkspaceMismatchError when the two sides differ', () => {
    expect(() => assertWorkspaceCompatibility('production', 'sandbox')).toThrow(WorkspaceMismatchError);
    expect(() =>
      assertWorkspaceCompatibility({ environment: 'production' }, { environment: 'sandbox' })
    ).toThrow(/is not compatible with/);
  });
});
