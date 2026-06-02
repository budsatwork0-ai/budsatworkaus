import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase service client ─────────────────────────────────────────────
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default chain: from().select().in()
  mockFrom.mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
  });
  mockSelect.mockReturnValue({ in: mockIn });
});

describe('checkPipelineHealth', () => {
  it('warns when no emission records exist', async () => {
    mockIn.mockResolvedValueOnce({ data: [], error: null });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkPipelineHealth } = await import('@/lib/pipeline/health-check');
    await checkPipelineHealth();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No emission ever recorded for "ux_proposals"')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No emission ever recorded for "conversion_signals"')
    );
    warnSpy.mockRestore();
  });

  it('warns when last emission is older than 24h', async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockIn.mockResolvedValueOnce({
      data: [
        { table_name: 'ux_proposals', last_emitted_at: old },
        { table_name: 'conversion_signals', last_emitted_at: old },
      ],
      error: null,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkPipelineHealth } = await import('@/lib/pipeline/health-check');
    await checkPipelineHealth();

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('silent for'));
    warnSpy.mockRestore();
  });

  it('does not warn when last emission is recent', async () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    mockIn.mockResolvedValueOnce({
      data: [
        { table_name: 'ux_proposals', last_emitted_at: recent },
        { table_name: 'conversion_signals', last_emitted_at: recent },
      ],
      error: null,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkPipelineHealth } = await import('@/lib/pipeline/health-check');
    await checkPipelineHealth();

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('warns if the health table query itself fails', async () => {
    mockIn.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { checkPipelineHealth } = await import('@/lib/pipeline/health-check');
    await checkPipelineHealth();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Could not read pipeline_health table'),
      'DB error'
    );
    warnSpy.mockRestore();
  });
});

describe('recordPipelineEmission', () => {
  it('upserts to pipeline_health with correct table_name', async () => {
    mockUpsert.mockResolvedValueOnce({ error: null });

    const { recordPipelineEmission } = await import('@/lib/pipeline/health-check');
    await recordPipelineEmission('conversion_signals');

    expect(mockFrom).toHaveBeenCalledWith('pipeline_health');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ table_name: 'conversion_signals' }),
      { onConflict: 'table_name' }
    );
  });

  it('warns but does not throw when upsert fails', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'upsert failed' } });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { recordPipelineEmission } = await import('@/lib/pipeline/health-check');
    await expect(recordPipelineEmission('ux_proposals')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to record emission timestamp'),
      'upsert failed'
    );
    warnSpy.mockRestore();
  });
});
