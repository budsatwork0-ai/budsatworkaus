// Regression guard for the client/server split described in
// src/lib/workspace/index.ts, client.ts and context.ts: nothing reachable
// from the client-safe entry points may import the server-only modules
// (AsyncLocalStorage, the Supabase service client). This is a static source
// check rather than a bundler check because the repo has no bundling step
// available inside the unit test suite.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const WORKSPACE_DIR = path.resolve(__dirname, '../../src/lib/workspace');

const FORBIDDEN_IN_CLIENT_GRAPH = [
  './context',
  './query',
  './repository',
  'node:async_hooks',
  '@supabase/supabase-js',
  '@/lib/supabase/server',
];

function importSpecifiers(fileName: string): string[] {
  const source = readFileSync(path.join(WORKSPACE_DIR, fileName), 'utf8');
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

describe('workspace client/server module boundary', () => {
  it('client.ts imports nothing server-only', () => {
    const imports = importSpecifiers('client.ts');
    for (const forbidden of FORBIDDEN_IN_CLIENT_GRAPH) {
      expect(imports).not.toContain(forbidden);
    }
  });

  it('WorkspaceProvider.tsx imports nothing server-only', () => {
    const imports = importSpecifiers('WorkspaceProvider.tsx');
    for (const forbidden of FORBIDDEN_IN_CLIENT_GRAPH) {
      expect(imports).not.toContain(forbidden);
    }
  });

  it('index.ts (the general barrel) imports nothing server-only', () => {
    const imports = importSpecifiers('index.ts');
    for (const forbidden of FORBIDDEN_IN_CLIENT_GRAPH) {
      expect(imports).not.toContain(forbidden);
    }
  });

  it('WorkspaceProvider.tsx only depends on ./types and react within the workspace module', () => {
    const imports = importSpecifiers('WorkspaceProvider.tsx').filter(
      (specifier) => specifier.startsWith('.') || specifier === 'react'
    );
    expect(imports.sort()).toEqual(['./types', 'react'].sort());
  });
});
