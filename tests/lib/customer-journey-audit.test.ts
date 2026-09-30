import { describe, expect, it } from 'vitest';
import { businessDateKey, formatBusinessDate, shiftCalendarDate } from '@/lib/business-date';
import { getInitialState } from '@/app/(public)/services/lib/wizard-state';
import { hasQuoteWork } from '@/app/(public)/services/lib/quote-work';
import { buildScopeSummary } from '@/app/(public)/services/lib/scope-summary';
import { scopePresetFor } from '@/app/(public)/services/lib/service-helpers';
import { calculateServicePrice } from '@/app/(public)/services/lib/estimation';

describe('audited customer journey regressions', () => {
  it('accepts a configured dump run even when the legacy selected map is empty', () => {
    const state = { ...getInitialState(), service: 'dump' as const, scope: 'dump_runs' as const, dumpRun: { loadType: 'trailer' as const, loads: 2 } };
    expect(hasQuoteWork(state, false)).toBe(true);
    expect(calculateServicePrice(state.scope, state).price).toBeGreaterThan(0);
    expect(buildScopeSummary(state, '$257', '~1h 45m')).toContain('trailer · 2 load(s)');
  });

  it('blocks empty bin cleans rather than accepting an unrelated dump-run default', () => {
    const state = { ...getInitialState(), service: 'dump' as const, scope: 'bin_cleans' as const };
    expect(hasQuoteWork(state, false)).toBe(false);
    state.paramsByService.dump = { redBins: 1 };
    expect(hasQuoteWork(state, false)).toBe(true);
  });

  it('initializes the existing sedan preset to a valid, priced express detail', () => {
    const state = { ...getInitialState(), service: 'auto' as const, scope: 'auto_express' as const };
    state.paramsByService.auto = scopePresetFor('auto', 'auto_express', 'home');
    expect(hasQuoteWork(state, false)).toBe(true);
    expect(calculateServicePrice(state.scope, state).price).toBe(120);
  });

  it('persists actual pane quantities instead of only the window scope code', () => {
    const state = getInitialState();
    state.winRows[0].int = 18;
    const summary = buildScopeSummary(state, '$336', '~5h');
    expect(summary).toContain('18 inside panes, 12 outside panes, 12 tracks, 12 screens');
    expect(summary).toContain('$336');
  });

  it('requires a measured yard and respects the NDIS address requirement', () => {
    const state = { ...getInitialState(), service: 'yard' as const, scope: 'yard_mow' as const };
    expect(hasQuoteWork(state, true)).toBe(false);
    state.manualYardAreaM2 = 400;
    expect(hasQuoteWork(state, true)).toBe(true);
    expect(hasQuoteWork(state, true, true)).toBe(false);
    state.address = 'Test service address';
    expect(hasQuoteWork(state, true, true)).toBe(true);
  });
});

describe('Brisbane operations dates', () => {
  it('uses the new Brisbane day before UTC midnight', () => {
    expect(businessDateKey(new Date('2026-09-29T15:00:00Z'))).toBe('2026-09-30');
    expect(formatBusinessDate('2026-09-29T15:00:00Z', { day: 'numeric', month: 'short' })).toBe('30 Sept');
  });
  it('preserves SQL calendar dates and crosses month/year boundaries', () => {
    expect(formatBusinessDate('2026-09-30', { day: 'numeric', month: 'short' })).toBe('30 Sept');
    expect(shiftCalendarDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftCalendarDate('2026-03-01', -1)).toBe('2026-02-28');
  });
});
