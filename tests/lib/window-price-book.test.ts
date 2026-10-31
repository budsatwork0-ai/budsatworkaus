import { describe, it, expect } from 'vitest';
import { windowQuoteTotal, DEFAULT_WINDOW_PRICES, windowBookFromRows } from '@/lib/pricing/window-price-book';
import { priceQuote } from '@/app/(public)/services/lib/pricing/engine';

describe('residential window price list', () => {
  it('20 panes both sides + 10 tracks + 10 screens = $330', () => {
    expect(windowQuoteTotal({ interior: 20, exterior: 20, tracks: 10, screens: 10 }, DEFAULT_WINDOW_PRICES).total).toBe(330);
  });
  it('applies the $150 minimum', () => {
    const q = windowQuoteTotal({ interior: 5, exterior: 5, tracks: 0, screens: 0 }, DEFAULT_WINDOW_PRICES);
    expect(q.subtotal).toBe(60);
    expect(q.total).toBe(150);
    expect(q.minimumApplied).toBe(true);
  });
  it('reads rows from price_list', () => {
    expect(windowBookFromRows([{ item: 'pane_interior', price: 7, minimum: null }, { item: 'job_minimum', price: null, minimum: 120 }]))
      .toEqual({ paneInterior: 7, minimum: 120 });
  });
  it('engine prices residential windows from the price list', () => {
    const q = priceQuote({
      context: 'home', currentService: 'windows', currentScope: 'windows_full',
      selected: { 'window.pane_int_solo': 20, 'window.pane_ext_solo': 20, 'window.track': 10, 'window.screen': 10 },
      distanceKm: 40, paidParking: false, tipFee: 0, conditionMult: 1,
      flags: { petHair: false, greaseSoap: false, clutterAccess: false, secondStorey: false },
    } as never);
    expect(q.total).toBe(330);
  });
});
