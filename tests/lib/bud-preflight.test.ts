import { describe, it, expect } from 'vitest';
import { preflightPatches } from '@/lib/bud/preflight';

const patch = (file: string, content: string) => [{ file, content, reason: 'test' }];

describe('preflightPatches — A1 Zod v4 z.record arity', () => {
  it('auto-fixes the real single-arg regression (z.record(z.unknown()))', () => {
    const src = `import { z } from 'zod';
export const S = z.object({ payload: z.record(z.unknown()).optional() });`;
    const res = preflightPatches(patch('src/agents/quote-triage/schema.ts', src));
    expect(res.ok).toBe(true);
    expect(res.autofixedCount).toBeGreaterThan(0);
    expect(res.patches[0].content).toContain('z.record(z.string(), z.unknown())');
    expect(res.findings.some((f) => f.rule === 'A1' && f.severity === 'autofix')).toBe(true);
  });

  it('leaves correct two-arg usage untouched', () => {
    const src = `const S = z.record(z.string(), z.unknown());`;
    const res = preflightPatches(patch('src/lib/x.ts', src));
    expect(res.findings).toHaveLength(0);
    expect(res.patches[0].content).toBe(src);
  });

  it('blocks the zero-arg form it cannot safely fix', () => {
    const res = preflightPatches(patch('src/lib/x.ts', `const S = z.record();`));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'A1' && f.severity === 'block')).toBe(true);
  });

  it('is idempotent — fixing twice produces no further changes', () => {
    const src = `const S = z.record(z.unknown());`;
    const once = preflightPatches(patch('src/lib/x.ts', src)).patches[0].content;
    const twice = preflightPatches(patch('src/lib/x.ts', once));
    expect(twice.autofixedCount).toBe(0);
    expect(twice.patches[0].content).toBe(once);
  });
});

describe('preflightPatches — block rules', () => {
  it('A2 blocks createClient import from the server module', () => {
    const src = `import { createClient } from '@/lib/supabase/server';`;
    const res = preflightPatches(patch('src/app/api/x/route.ts', src));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'A2')).toBe(true);
    expect(res.feedback).toContain('createServiceClient');
  });

  it('A3 blocks a *.test.ts file placed under src/', () => {
    const res = preflightPatches(patch('src/lib/agents/agents/foo.test.ts', 'export const x = 1;'));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'A3')).toBe(true);
  });

  it('A5 blocks brand.primary used as a button background (UI file only)', () => {
    const src = `<button style={{ background: brand.primary }}>Go</button>`;
    const res = preflightPatches(patch('src/app/ui/home/HomePage.tsx', src));
    expect(res.ok).toBe(false);
    expect(res.findings.some((f) => f.rule === 'A5')).toBe(true);
  });

  it('A7 blocks edits to forbidden config files', () => {
    expect(preflightPatches(patch('vercel.json', '{}')).ok).toBe(false);
    expect(preflightPatches(patch('.env.local', 'X=1')).ok).toBe(false);
    expect(preflightPatches(patch('next.config.ts', 'export default {}')).ok).toBe(false);
  });

  it('A8 blocks empty or truncated content', () => {
    expect(preflightPatches(patch('src/lib/x.ts', '   ')).ok).toBe(false);
    const truncated = `export function f() { if (true) { return 1;`;
    expect(preflightPatches(patch('src/lib/x.ts', truncated)).ok).toBe(false);
  });
});

describe('preflightPatches — autofix rules', () => {
  it('A4 rewrites style={{...glass}} to className={glass} on a UI file', () => {
    const src = `<div style={{...glass}}>x</div>`;
    const res = preflightPatches(patch('src/app/ui/home/HomePage.tsx', src));
    expect(res.patches[0].content).toContain('className={glass}');
    expect(res.findings.some((f) => f.rule === 'A4' && f.severity === 'autofix')).toBe(true);
  });

  it('A6 rewrites a bad theme import path to @/app/ui/theme', () => {
    const src = `import { glass, brand } from '../theme';`;
    const res = preflightPatches(patch('src/app/ui/home/HomePage.tsx', src));
    expect(res.patches[0].content).toContain("from '@/app/ui/theme'");
    expect(res.findings.some((f) => f.rule === 'A6')).toBe(true);
  });

  it('does not touch non-token imports from ../theme', () => {
    const src = `import { somethingElse } from '../theme';`;
    const res = preflightPatches(patch('src/app/ui/home/HomePage.tsx', src));
    expect(res.patches[0].content).toBe(src);
  });
});

describe('preflightPatches — clean input', () => {
  it('returns ok with no findings for a clean file', () => {
    const src = `import { createServiceClient } from '@/lib/supabase/server';
export async function run() { return createServiceClient(); }`;
    const res = preflightPatches(patch('src/lib/x.ts', src));
    expect(res.ok).toBe(true);
    expect(res.findings).toHaveLength(0);
    expect(res.feedback).toBe('');
  });
});
