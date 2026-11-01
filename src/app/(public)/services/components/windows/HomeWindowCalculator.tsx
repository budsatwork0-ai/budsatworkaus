'use client';

import React from 'react';
import { PREMIUM_UI } from '../shared/simple-cards';
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
    <div className={PREMIUM_UI ? "flex items-center justify-between gap-3 py-3 border-b border-black/[0.06] last:border-0" : "flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2.5"}>
      {PREMIUM_UI ? (
        <p className="min-w-0 leading-tight"><span className="block text-[16px] font-medium text-slate-900 tracking-[-0.01em]">{label}</span><span className="text-[13px] text-slate-500">{hint}</span></p>
      ) : (
      <p className="min-w-0 text-base font-semibold text-[#0F3F33]">{label} <span className="text-sm font-normal text-slate-500">· {hint}</span></p>
      )}
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(0, value - 1))}
          className={PREMIUM_UI ? "h-9 w-9 rounded-full border border-black/10 text-lg text-slate-900 transition active:scale-90 active:bg-slate-100" : "h-10 w-10 rounded-full border border-emerald-200 text-xl font-bold text-emerald-700 active:bg-emerald-50"}>−</button>
        <input aria-label={label} inputMode="numeric" type="number" min={0} value={value}
          onChange={(e) => onChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className={PREMIUM_UI ? "w-10 bg-transparent py-1 text-center text-[17px] font-medium text-slate-900 tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" : "w-14 rounded-lg border border-slate-200 py-1.5 text-center text-base font-semibold"} />
        <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value + 1)}
          className={PREMIUM_UI ? "h-9 w-9 rounded-full border border-black/10 text-lg text-slate-900 transition active:scale-90 active:bg-slate-100" : "h-10 w-10 rounded-full bg-emerald-600 text-xl font-bold text-white active:bg-emerald-700"}>+</button>
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
    <section aria-label="Window calculator" className={PREMIUM_UI ? "pt-1 space-y-2" : "rounded-2xl border border-emerald-100 bg-[#F4FBF7] p-4 space-y-3"}>
      <div className={PREMIUM_UI ? "grid grid-cols-3 rounded-full bg-slate-100 p-1" : "grid grid-cols-3 gap-2"}>
        {(['both', 'inside', 'outside'] as Mode[]).map((m) => (
          <button key={m} type="button" onClick={() => write(m, panes, tracks, screens)}
            className={PREMIUM_UI
              ? `rounded-full py-2 text-[14px] font-medium transition-all duration-200 ${mode === m ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-slate-500'}`
              : `rounded-xl py-2.5 text-base font-semibold ${mode === m ? 'bg-emerald-600 text-white' : 'bg-white text-[#0F3F33] border border-emerald-100'}`}>
            {m === 'both' ? 'Both sides' : m === 'inside' ? 'Inside' : 'Outside'}
          </button>
        ))}
      </div>
      <Stepper label="Panes" hint={mode === 'both' ? `${money(book.paneInterior + book.paneExterior)} both sides` : `${money(mode === 'inside' ? book.paneInterior : book.paneExterior)} each`} value={panes}
        onChange={(n) => write(mode, n, tracks, screens)} />
      <Stepper label="Tracks" hint={`${money(book.track)} each`} value={tracks} onChange={(n) => write(mode, panes, n, screens)} />
      <Stepper label="Screens" hint={`${money(book.screen)} each`} value={screens} onChange={(n) => write(mode, panes, tracks, n)} />

      <div className={PREMIUM_UI ? "flex items-baseline justify-between border-t border-black/[0.06] pt-3" : "flex items-baseline justify-between border-t border-emerald-100 pt-2"} aria-live="polite">
        <span className="text-xs text-slate-500">No GST · min {money(book.minimum)}</span>
        <span className={PREMIUM_UI ? "text-[26px] font-semibold tracking-[-0.02em] text-slate-900 tabular-nums" : "text-xl font-bold text-[#0F3F33]"} data-testid="window-total">{money(q.total)}</span>
      </div>
      <p className="text-xs text-slate-500">
        Oversized panes, heavily soiled windows, and paint or hard-water stains are quoted on the day.
      </p>
    </section>
  );
}
