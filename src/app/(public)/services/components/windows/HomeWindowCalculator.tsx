'use client';

import React from 'react';
import type { WizardState, ScopeKey } from '../../types';
import {
  getWindowPriceBook,
  setWindowPriceBook,
  windowBookFromRows,
  windowQuoteTotal,
  type PriceListRow,
} from '@/lib/pricing/window-price-book';

type Mode = 'both' | 'inside' | 'outside';
const SCOPE: Record<Mode, ScopeKey> = { both: 'windows_full', inside: 'windows_interior', outside: 'windows_exterior' };

function Stepper({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2.5">
      <p className="min-w-0 text-base font-semibold text-[#0F3F33]">{label} <span className="text-sm font-normal text-slate-500">· {hint}</span></p>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))}
          className="h-10 w-10 rounded-full border border-emerald-200 text-xl font-bold text-emerald-700 active:bg-emerald-50">−</button>
        <input aria-label={label} inputMode="numeric" type="number" min={0} value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-14 rounded-lg border border-slate-200 py-1.5 text-center text-base font-semibold" />
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value + 1)}
          className="h-10 w-10 rounded-full bg-emerald-600 text-xl font-bold text-white active:bg-emerald-700">+</button>
      </div>
    </div>
  );
}

export function HomeWindowCalculator({ S, setMany }: { S: WizardState; setMany: (v: Partial<WizardState>) => void }) {
  const mode: Mode = S.scope === 'windows_interior' ? 'inside' : S.scope === 'windows_exterior' ? 'outside' : 'both';
  const r0 = S.winRows[0] ?? { int: 0, ext: 0, tracks: 0, screens: 0 };
  const sum = (k: 'int' | 'ext' | 'tracks' | 'screens') => S.winRows.reduce((a, r) => a + (r[k] || 0), 0);
  const panes = Math.max(sum('int'), sum('ext'));
  const tracks = sum('tracks');
  const screens = sum('screens');
  const [book, setBook] = React.useState(getWindowPriceBook());

  const write = (m: Mode, p: number, t: number, s: number) => {
    setMany({
      scope: SCOPE[m],
      winRows: [{ ...r0, label: 'Home', int: m === 'outside' ? 0 : p, ext: m === 'inside' ? 0 : p, tracks: t, screens: s }],
      winStoreys: 1,
    });
  };

  React.useEffect(() => {
    let alive = true;
    fetch('/api/price-list?service=windows')
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: PriceListRow[] }) => {
        if (!alive || !j.rows?.length) return;
        setWindowPriceBook(windowBookFromRows(j.rows));
        setBook(getWindowPriceBook());
        write(mode, panes, tracks, screens); // re-run the estimate with live prices
      })
      .catch(() => { /* keep backup prices */ });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interior = mode === 'outside' ? 0 : panes;
  const exterior = mode === 'inside' ? 0 : panes;
  const q = windowQuoteTotal({ interior, exterior, tracks, screens }, book);
  const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;

  return (
    <section aria-label="Window calculator" className="rounded-2xl border border-emerald-100 bg-[#F4FBF7] p-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(['both', 'inside', 'outside'] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => write(m, panes, tracks, screens)}
            className={`rounded-xl py-2.5 text-base font-semibold ${mode === m ? 'bg-emerald-600 text-white' : 'bg-white text-[#0F3F33] border border-emerald-100'}`}>
            {m === 'both' ? 'Both sides' : m === 'inside' ? 'Inside' : 'Outside'}
          </button>
        ))}
      </div>
      <Stepper label="Panes" hint={mode === 'both' ? `${money(book.paneInterior + book.paneExterior)} both sides` : `${money(mode === 'inside' ? book.paneInterior : book.paneExterior)} each`} value={panes}
        onChange={(n) => write(mode, n, tracks, screens)} />
      <Stepper label="Tracks" hint={`${money(book.track)} each`} value={tracks} onChange={(n) => write(mode, panes, n, screens)} />
      <Stepper label="Screens" hint={`${money(book.screen)} each`} value={screens} onChange={(n) => write(mode, panes, tracks, n)} />

      <div className="flex items-baseline justify-between border-t border-emerald-100 pt-2" aria-live="polite">
        <span className="text-xs text-slate-500">No GST · min {money(book.minimum)}</span>
        <span className="text-xl font-bold text-[#0F3F33]" data-testid="window-total">{money(q.total)}</span>
      </div>
      <p className="text-xs text-slate-500">
        Oversized panes, heavily soiled windows, and paint or hard-water stains are quoted on the day.
      </p>
    </section>
  );
}
