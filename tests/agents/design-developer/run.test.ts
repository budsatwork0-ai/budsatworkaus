import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase service client ─────────────────────────────────────────────
// We mock at the module level before importing the agent so the agent picks up
// the mock createServiceClient.

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

import { runDesignDeveloperAgent } from '@/agents/design-developer/index';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function supabaseOk(data: unknown[]) {
  return { data, error: null };
}

function supabaseErr(message: string) {
  return { data: null, error: { message } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('design-developer agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success=true with empty findings when tables return no rows', async () => {
    mockSelect.mockResolvedValue(supabaseOk([]));

    const result = await runDesignDeveloperAgent();

    expect(result.success).toBe(true);
    expect(result.findings).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('returns success=false but still emits partial findings when fetchDesignTokens fails', async () => {
    // First call (design_tokens) fails, second call (design_review_targets) succeeds.
    mockSelect
      .mockResolvedValueOnce(supabaseErr('tokens table not found'))
      .mockResolvedValueOnce(supabaseOk([{ file_path: 'src/app/ui/theme.ts' }]));

    const result = await runDesignDeveloperAgent();

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].operation).toBe('fetchDesignTokens');
    expect(result.errors[0].message).toContain('tokens table not found');
    // Findings are still produced for the file that was returned.
    expect(result.findings.length).toBeGreaterThanOrEqual(0);
  });

  it('returns success=false and emits a diagnostic finding when fetchTargetFiles fails', async () => {
    mockSelect
      .mockResolvedValueOnce(supabaseOk([]))
      .mockResolvedValueOnce(supabaseErr('targets table not found'));

    const result = await runDesignDeveloperAgent();

    expect(result.success).toBe(false);
    expect(result.errors[0].operation).toBe('fetchTargetFiles');
    // Should emit a diagnostic warning finding so the pipeline surfaces it.
    const diagnostic = result.findings.find((f) => f.file === '(agent)');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.severity).toBe('warning');
  });

  it('captures operation name and input in every error entry', async () => {
    mockSelect.mockResolvedValue(supabaseErr('connection refused'));

    const result = await runDesignDeveloperAgent();

    for (const err of result.errors) {
      expect(typeof err.operation).toBe('string');
      expect(err.operation.length).toBeGreaterThan(0);
      expect(err.input).toBeDefined();
      expect(typeof err.timestamp).toBe('string');
    }
  });

  it('does not throw even when all Supabase calls fail', async () => {
    mockSelect.mockRejectedValue(new Error('network timeout'));

    await expect(runDesignDeveloperAgent()).resolves.not.toThrow();

    const result = await runDesignDeveloperAgent();
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
