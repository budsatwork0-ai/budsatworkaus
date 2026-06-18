import { describe, expect, it } from 'vitest';
import { calculateFundraisingTotals } from '@/lib/fundraising/totals';

const item = {
  id: 'item_1',
  goal_amount_cents: 10_000,
  manual_adjustment_cents: 0,
};

describe('calculateFundraisingTotals', () => {
  it('counts only paid contributions', () => {
    const totals = calculateFundraisingTotals(item, [
      { fundraising_item_id: 'item_1', amount_cents: 2_500, status: 'paid' },
      { fundraising_item_id: 'item_1', amount_cents: 3_000, status: 'pending' },
      { fundraising_item_id: 'item_1', amount_cents: 4_000, status: 'failed' },
      { fundraising_item_id: 'item_1', amount_cents: 5_000, status: 'refunded' },
    ]);

    expect(totals.raised_amount_cents).toBe(2_500);
    expect(totals.verified_raised_amount_cents).toBe(2_500);
    expect(totals.contribution_count).toBe(1);
    expect(totals.remaining_amount_cents).toBe(7_500);
  });

  it('preserves zero values explicitly', () => {
    const totals = calculateFundraisingTotals(item, []);

    expect(totals.raised_amount_cents).toBe(0);
    expect(totals.progress_percentage).toBe(0);
    expect(totals.remaining_amount_cents).toBe(10_000);
    expect(totals.is_funded).toBe(false);
  });

  it('adds manual adjustment separately when present', () => {
    const totals = calculateFundraisingTotals({ ...item, manual_adjustment_cents: 1_000 }, [
      { fundraising_item_id: 'item_1', amount_cents: 9_000, status: 'paid' },
    ]);

    expect(totals.verified_raised_amount_cents).toBe(9_000);
    expect(totals.manual_adjustment_cents).toBe(1_000);
    expect(totals.raised_amount_cents).toBe(10_000);
    expect(totals.is_funded).toBe(true);
  });
});
