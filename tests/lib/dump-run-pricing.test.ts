import { describe, it, expect, vi } from 'vitest';

// service-data.tsx contains JSX (icon components) which rolldown can't parse
// in a node test environment. The dump-run code path returns before TASK_MAP
// is ever consulted, so an empty map is a safe stub here.
vi.mock('@/app/(public)/services/lib/service-data', () => ({ TASK_MAP: new Map() }));

import { priceQuote } from '@/app/(public)/services/lib/pricing/engine';
import type { QuoteParams } from '@/app/(public)/services/types';

const base: QuoteParams = {
  context: 'home',
  currentService: 'dump',
  currentScope: 'dump_runs',
  selected: {},
  distanceKm: 0,
  paidParking: false,
  tipFee: 0,
  conditionMult: 1,
  conditionLevel: 'standard',
  flags: { petHair: false, greaseSoap: false, clutterAccess: false, secondStorey: false },
  commercialUplift: 0,
  sizeAdjust: 'standard',
  conditionFlat: 0,
  contractDiscount: 0,
  commercialType: null,
  afterHours: false,
};

// Regression suite for Step 5: inline dump run locals collapsed into canonical
// imports (BASE_CALLOUT_PRICE, EFFORT_BLOCK_RANGE, PHYSICAL_BLOCK_RANGE).
// All expected values are pre-calculated from the inline constants and must
// remain byte-for-byte identical after the refactor.
describe('dump run pricing — numeric regression', () => {
  it('single_item × 1 load', () => {
    // labour = 79 + 0.4×27.5 = 90, disposal = 15, minutes = 30 + round(0.4×20) = 38
    const r = priceQuote({ ...base, dumpRunSelection: { loadType: 'single_item', loads: 1 } });
    expect(r.total).toBe(105);
    expect(r.unitSum).toBe(90);
    expect(r.disposalFee).toBe(15);
    expect(r.minutes).toBe(38);
    expect(r.billableMinutes).toBe(38);
    expect(r.baseBeforeFees).toBe(105);
    expect(r.travel).toBe(0);
    expect(r.parking).toBe(0);
    expect(r.labourFloor).toBe(0);
    expect(r.tip).toBe(0);
    expect(r.billingMode).toBe('Per-unit');
    expect(r.confidence).toBe('High');
  });

  it('ute × 1 load', () => {
    // labour = 79 + 1.5×27.5 = 120.25 → 120, disposal = 15, minutes = 30+30 = 60
    const r = priceQuote({ ...base, dumpRunSelection: { loadType: 'ute', loads: 1 } });
    expect(r.total).toBe(135);
    expect(r.unitSum).toBe(120);
    expect(r.disposalFee).toBe(15);
    expect(r.minutes).toBe(60);
    expect(r.billableMinutes).toBe(60);
    expect(r.baseBeforeFees).toBe(135);
    expect(r.travel).toBe(0);
    expect(r.parking).toBe(0);
  });

  it('half_trailer × 1 load', () => {
    // effortBlocks = 1×1.5+0.5 = 2, labour = 79+2×27.5 = 134, disposal = 34, minutes = 30+40 = 70
    const r = priceQuote({ ...base, dumpRunSelection: { loadType: 'half_trailer', loads: 1 } });
    expect(r.total).toBe(168);
    expect(r.unitSum).toBe(134);
    expect(r.disposalFee).toBe(34);
    expect(r.minutes).toBe(70);
    expect(r.billableMinutes).toBe(70);
    expect(r.baseBeforeFees).toBe(168);
  });

  it('bulky × 1 load', () => {
    // effortBlocks = 1.5, physicalBlocks = 1, labour = 79+1.5×27.5+1×37.5 = 157.75 → 158
    // disposal = 55, minutes = 30 + round(1.5×20 + 1×10) = 70
    const r = priceQuote({ ...base, dumpRunSelection: { loadType: 'bulky', loads: 1 } });
    expect(r.total).toBe(213);
    expect(r.unitSum).toBe(158);
    expect(r.disposalFee).toBe(55);
    expect(r.minutes).toBe(70);
    expect(r.billableMinutes).toBe(70);
    expect(r.baseBeforeFees).toBe(213);
    expect(r.travel).toBe(0);
    expect(r.parking).toBe(0);
  });

  it('trailer × 2 loads with out-of-zone travel and parking', () => {
    // effortBlocks = 2×1.5+1 = 4, labour = 79+4×27.5 = 189, disposal = 34×2 = 68
    // travel = (30-25)×1.2 = 6, parking = 10, minutes = 30+80 = 110
    const r = priceQuote({
      ...base,
      distanceKm: 30,
      paidParking: true,
      dumpRunSelection: { loadType: 'trailer', loads: 2 },
    });
    expect(r.total).toBe(273);
    expect(r.unitSum).toBe(189);
    expect(r.disposalFee).toBe(68);
    expect(r.minutes).toBe(110);
    expect(r.billableMinutes).toBe(110);
    expect(r.travel).toBe(6);
    expect(r.parking).toBe(10);
    expect(r.baseBeforeFees).toBe(257);
  });
});
