// Residential window prices. Live values come from the `price_list` table
// (admin > Price list). These code values are the backup if the table can't be read.
export type WindowPriceBook = {
  paneInterior: number;
  paneExterior: number;
  track: number;
  screen: number;
  minimum: number;
};

export const DEFAULT_WINDOW_PRICES: WindowPriceBook = {
  paneInterior: 6,
  paneExterior: 6,
  track: 5,
  screen: 4,
  minimum: 150,
};

let current: WindowPriceBook = { ...DEFAULT_WINDOW_PRICES };

export function getWindowPriceBook(): WindowPriceBook {
  return current;
}

export function setWindowPriceBook(next: Partial<WindowPriceBook>) {
  const clean: Partial<WindowPriceBook> = {};
  for (const [k, v] of Object.entries(next)) {
    const n = Number(v);
    if (v != null && Number.isFinite(n) && n >= 0) (clean as Record<string, number>)[k] = n;
  }
  current = { ...current, ...clean };
}

export type PriceListRow = { item: string; price: number | null; minimum: number | null; active?: boolean };

export function windowBookFromRows(rows: PriceListRow[]): Partial<WindowPriceBook> {
  const out: Partial<WindowPriceBook> = {};
  for (const r of rows) {
    if (r.active === false) continue;
    if (r.item === 'pane_interior' && r.price != null) out.paneInterior = Number(r.price);
    if (r.item === 'pane_exterior' && r.price != null) out.paneExterior = Number(r.price);
    if (r.item === 'track' && r.price != null) out.track = Number(r.price);
    if (r.item === 'screen' && r.price != null) out.screen = Number(r.price);
    if (r.item === 'job_minimum' && r.minimum != null) out.minimum = Number(r.minimum);
  }
  return out;
}

export function windowQuoteTotal(
  counts: { interior: number; exterior: number; tracks: number; screens: number },
  book: WindowPriceBook = current,
) {
  const n = (x: number) => Math.max(0, Math.round(x || 0));
  const subtotal =
    n(counts.interior) * book.paneInterior +
    n(counts.exterior) * book.paneExterior +
    n(counts.tracks) * book.track +
    n(counts.screens) * book.screen;
  const minimumApplied = subtotal > 0 && subtotal < book.minimum;
  return { subtotal, total: subtotal === 0 ? 0 : Math.max(subtotal, book.minimum), minimumApplied };
}
