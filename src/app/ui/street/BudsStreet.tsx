'use client';

// Buds Street — windows trial. Hand-drawn street; tap windows, a ticket prints your visit.
// Prices come only from the window price book (windowQuoteTotal) — same as the window calculator.
import React from 'react';
import Link from 'next/link';
import {
  getWindowPriceBook,
  setWindowPriceBook,
  windowBookFromRows,
  windowQuoteTotal,
  type PriceListRow,
} from '@/lib/pricing/window-price-book';

const GREEN = '#15803D';
const INK = '#2B2A26';
const PAPER = '#F6F1E6';

type Win = { id: string; label: string; x: number; y: number; w: number; h: number; panes: number; track: boolean; screen: boolean; split?: boolean };
const WINDOWS: Win[] = [
  { id: 'lounge', label: 'Lounge slider', x: 106, y: 144, w: 44, h: 30, panes: 2, track: true, screen: true, split: true },
  { id: 'study', label: 'Study window', x: 158, y: 144, w: 22, h: 30, panes: 1, track: false, screen: true },
  { id: 'side', label: 'Door sidelight', x: 216, y: 142, w: 9, h: 48, panes: 1, track: false, screen: false },
  { id: 'bed', label: 'Bedroom slider', x: 236, y: 144, w: 44, h: 30, panes: 2, track: true, screen: true, split: true },
  { id: 'bath', label: 'Bathroom window', x: 288, y: 144, w: 12, h: 18, panes: 1, track: false, screen: true },
];
// A window not shown counts as a standard two-pane slider with a track and a screen.
const EXTRA = { panes: 2, track: 1, screen: 1 };

type Sel = { tracks: boolean; screens: boolean };
type Box = { cx: number; cy: number; w: number; h: number };
const STREET: Box = { cx: 200, cy: 182, w: 250, h: 200 };
const FRONT: Box = { cx: 203, cy: 170, w: 232, h: 96 };

const money = (n: number) => `$${n.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const buzz = (ms = 12) => { try { if (!reduced()) navigator.vibrate?.(ms); } catch { /* not supported */ } };

function useAspect(ref: React.RefObject<HTMLDivElement | null>) {
  const [a, setA] = React.useState(0.75);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const r = e.contentRect; if (r.width && r.height) setA(r.width / r.height); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return a;
}

function fit(b: Box, a: number) {
  const w = Math.max(b.w, b.h * a);
  const h = w / a;
  // extra height goes to the sky so the street sits low on tall phones
  return [b.cx - w / 2, b.cy + b.h / 2 - h, w, h];
}

function useTicker(target: number) {
  const [v, setV] = React.useState(target);
  const from = React.useRef(target);
  React.useEffect(() => {
    if (reduced()) { setV(target); from.current = target; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = Math.round(a + (target - a) * e);
      setV(cur);
      from.current = cur;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

function House({ sel, active, onTap, sparkle }: { sel: Record<string, Sel>; active: string | null; onTap: (id: string) => void; sparkle: { id: string; n: number } | null }) {
  const corr = Array.from({ length: 34 }, (_, i) => 84 + i * 7);
  const balusters = Array.from({ length: 40 }, (_, i) => 100 + i * 5.2).filter((x) => x < 186 || x > 228);
  return (
    <g>
      {/* sky light + sun */}
      <circle cx={292} cy={14} r={16} fill="#F7D774" opacity={0.75} className="bs-sun" />
      <g className="bs-cloud" fill="#fff" stroke={INK} strokeWidth={0.9} filter="url(#bs-ink)">
        <path d="M40 70 q8 -14 22 -6 q10 -12 22 0 q14 -2 12 10 q-2 8 -12 6 h-40 q-12 0 -4 -10z" />
      </g>
      <g className="bs-cloud2" fill="#fff" stroke={INK} strokeWidth={0.8} filter="url(#bs-ink)" opacity={0.9}>
        <path d="M230 -10 q6 -10 16 -4 q8 -9 17 0 q10 -1 9 7 q-1 6 -9 5 h-29 q-9 0 -4 -8z" />
      </g>
      {/* birds */}
      <path d="M150 20 q4 -4 8 0 q4 -4 8 0 M178 4 q3 -3 6 0 q3 -3 6 0" fill="none" stroke={INK} strokeWidth={0.7} opacity={0.6} />
      {/* distant hills */}
      <path d="M-600 228 L-20 228 Q60 196 140 214 Q230 186 330 206 Q400 190 460 212 L1000 228 Z" fill="#D6E2CF" opacity={0.7} />
      {/* ground */}
      <rect x={-600} y={228} width={1600} height={300} fill="#E4E9D2" />
      <path d="M-600 228 H1000" stroke={INK} strokeWidth={1} filter="url(#bs-ink)" />
      <path d="M-600 262 H1000" stroke={INK} strokeWidth={0.8} strokeDasharray="10 7" opacity={0.5} />
      <path d="M185 228 L170 262 M221 228 L236 262" stroke={INK} strokeWidth={0.8} opacity={0.55} />

      <g filter="url(#bs-ink)" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round">
        {/* hills hoist behind */}
        <g opacity={0.6} fill="none"><path d="M362 228 V168 M338 172 L386 164 M340 164 L384 172" /><path d="M342 170 q20 6 40 0" strokeDasharray="2 3" /></g>
        {/* stumps */}
        {[104, 140, 176, 230, 266, 300].map((x) => <path key={x} d={`M${x} 205 V228`} />)}
        <path d="M100 216 L300 216" opacity={0.35} />
        {/* stairs */}
        <g fill={PAPER}><path d="M190 205 L184 228 M216 205 L222 228" />{[210, 216, 222].map((y) => <path key={y} d={`M${188 - (y - 205) / 4} ${y} H${218 + (y - 205) / 4}`} />)}</g>
        {/* walls (weatherboard) */}
        <rect x={98} y={128} width={206} height={77} fill="#FBF7EE" />
        {Array.from({ length: 10 }, (_, i) => <path key={i} d={`M98 ${134 + i * 7.5} H304`} strokeWidth={0.5} opacity={0.35} />)}
        {/* roof — corrugated hip */}
        <path d="M80 130 L322 130 L272 84 L130 84 Z" fill="#C9D3CB" />
        {corr.map((x) => <path key={x} d={`M${x + (x - 200) * -0.0} 130 L${130 + (x - 84) * (142 / 238)} 84`} strokeWidth={0.45} opacity={0.5} />)}
        <path d="M80 130 L322 130" strokeWidth={1.6} />
        {/* verandah posts + rail */}
        {[100, 186, 228, 302].map((x) => <path key={x} d={`M${x} 130 V205`} strokeWidth={1.4} />)}
        <path d="M100 186 H186 M228 186 H302 M100 204 H302" />
        {balusters.map((x) => <path key={x} d={`M${x} 187 V203`} strokeWidth={0.6} />)}
        {/* screen door */}
        <rect x={190} y={142} width={22} height={62} fill="#E9EFE6" />
        <path d="M193 145 h16 v26 h-16z M193 175 h16 v26 h-16z" strokeWidth={0.6} fill="none" />
        <path d="M193 158 q8 -6 16 0 M193 188 q8 -6 16 0" strokeWidth={0.5} opacity={0.6} fill="none" />
        <circle cx={208} cy={174} r={0.9} fill={INK} />
      </g>

      {/* windows */}
      {WINDOWS.map((w) => {
        const on = !!sel[w.id];
        return (
          <g key={w.id}>
            <rect x={w.x} y={w.y} width={w.w} height={w.h} fill={on ? '#DDF3E4' : '#D7E3EA'} stroke={INK} strokeWidth={1.1} filter="url(#bs-ink)" className="bs-glass" />
            {on && <rect x={w.x - 3} y={w.y - 3} width={w.w + 6} height={w.h + 6} rx={3} fill="none" stroke={GREEN} strokeWidth={1.4} opacity={active === w.id ? 1 : 0.55} className="bs-glow" />}
            {w.split && <path d={`M${w.x + w.w / 2} ${w.y} V${w.y + w.h}`} stroke={INK} strokeWidth={0.8} filter="url(#bs-ink)" />}
            {w.id === 'bath' && [0, 1, 2, 3].map((i) => <path key={i} d={`M${w.x + 1} ${w.y + 4 + i * 4} H${w.x + w.w - 1}`} stroke={INK} strokeWidth={0.4} opacity={0.6} />)}
            {on && <path d={`M${w.x + 3} ${w.y + w.h - 4} L${w.x + Math.min(10, w.w - 2)} ${w.y + 3}`} stroke="#fff" strokeWidth={1.4} strokeLinecap="round" opacity={0.9} />}
            {sparkle?.id === w.id && (
              <g key={sparkle.n} className="bs-sparkle" style={{ transformOrigin: `${w.x + w.w / 2}px ${w.y + w.h / 2}px` }}>
                <clipPath id={`clip-${w.id}-${sparkle.n}`}><rect x={w.x} y={w.y} width={w.w} height={w.h} /></clipPath>
                <rect className="bs-squeegee" x={w.x - 14} y={w.y} width={10} height={w.h} fill="#fff" opacity={0.7} clipPath={`url(#clip-${w.id}-${sparkle.n})`} />
                <path d={`M${w.x + w.w - 4} ${w.y - 6} l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5z`} fill="#FBBF24" />
              </g>
            )}
            <rect role="button" tabIndex={0} aria-pressed={on} aria-label={`${w.label}, ${w.panes} pane${w.panes > 1 ? 's' : ''}`}
              x={w.x - 6} y={w.y - 6} width={w.w + 12} height={w.h + 12} fill="transparent" className="bs-hit"
              onClick={() => onTap(w.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(w.id); } }} />
          </g>
        );
      })}

      {/* gum tree */}
      <g className="bs-tree" filter="url(#bs-ink)" stroke={INK} strokeWidth={1.1} strokeLinecap="round">
        <path d="M52 228 C50 200 56 170 48 140 M50 175 C40 160 30 150 26 136 M52 160 C62 148 70 140 74 124" fill="none" strokeWidth={2.2} />
        <g fill="#A9C4A0" opacity={0.95}>
          <path d="M14 140 q10 -26 34 -22 q14 -18 34 -2 q16 4 8 22 q-6 14 -24 8 q-14 12 -30 2 q-26 6 -22 -8z" />
          <path d="M30 116 q12 -16 30 -10 q14 -6 18 8" fill="none" />
        </g>
      </g>
      {/* frangipani */}
      <g filter="url(#bs-ink)" stroke={INK} strokeWidth={0.9}>
        <path d="M322 228 V206 L314 196 M322 206 L330 196" fill="none" strokeWidth={1.4} />
        <ellipse cx={312} cy={193} rx={8} ry={5} fill="#B8CFA8" /><ellipse cx={331} cy={193} rx={8} ry={5} fill="#B8CFA8" />
        {[[309, 191], [315, 194], [329, 190], [334, 194]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={1.6} fill="#FFF6D6" />)}
      </g>
      {/* letterbox + wheelie bin */}
      <g filter="url(#bs-ink)" stroke={INK} strokeWidth={1}>
        <path d="M344 236 V216" strokeWidth={1.4} /><rect x={337} y={208} width={14} height={9} rx={2} fill="#E6DCC8" /><path d="M340 211 h8" strokeWidth={0.6} />
        <rect x={358} y={214} width={14} height={20} fill="#3F5F4A" /><rect x={357} y={211} width={16} height={4} fill="#E3B341" />
        <circle cx={360} cy={236} r={1.8} fill={PAPER} />
      </g>
      {/* soft light shift */}
      <rect x={-600} y={-600} width={1600} height={1200} fill="#FFE9B0" className="bs-light" pointerEvents="none" />
    </g>
  );
}

type Line = { key: string; left: string; right?: string; strong?: boolean; muted?: boolean };

export function BudsStreet() {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const aspect = useAspect(stageRef);
  const [zoomed, setZoomed] = React.useState(false);
  const [vb, setVb] = React.useState<number[] | null>(null);
  const [sel, setSel] = React.useState<Record<string, Sel>>({});
  const [active, setActive] = React.useState<string | null>(null);
  const [outside, setOutside] = React.useState(true);
  const [inside, setInside] = React.useState(true);
  const [extra, setExtra] = React.useState(0);
  const [sparkle, setSparkle] = React.useState<{ id: string; n: number } | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [torn, setTorn] = React.useState(false);
  const [book, setBook] = React.useState(getWindowPriceBook());

  React.useEffect(() => {
    let alive = true;
    fetch('/api/price-list?service=windows')
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .then((j: { rows?: PriceListRow[] }) => {
        if (!alive || !j.rows?.length) return;
        setWindowPriceBook(windowBookFromRows(j.rows));
        setBook(getWindowPriceBook());
      })
      .catch(() => { /* keep backup prices */ });
    return () => { alive = false; };
  }, []);

  // viewBox zoom tween
  const target = React.useMemo(() => fit(zoomed ? FRONT : STREET, aspect), [zoomed, aspect]);
  const vbRef = React.useRef<number[] | null>(null);
  React.useEffect(() => {
    const from = vbRef.current;
    if (!from || reduced()) { vbRef.current = target; setVb(target); return; }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const cur = from.map((f, i) => f + (target[i] - f) * e);
      vbRef.current = cur;
      setVb(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const tap = (id: string) => {
    if (!zoomed) { setZoomed(true); return; }
    const w = WINDOWS.find((x) => x.id === id)!;
    if (sel[id] && active === id) {
      const next = { ...sel }; delete next[id];
      setSel(next); setActive(null); buzz(6);
      return;
    }
    if (!sel[id]) {
      setSel({ ...sel, [id]: { tracks: w.track, screens: w.screen } });
      setSparkle({ id, n: Date.now() });
      buzz(14);
    }
    setActive(id);
  };

  // counts → the same inputs the window calculator writes (winRows int/ext/tracks/screens)
  const chosen = WINDOWS.filter((w) => sel[w.id]);
  const panes = chosen.reduce((a, w) => a + w.panes, 0) + extra * EXTRA.panes;
  const tracks = chosen.reduce((a, w) => a + (w.track && sel[w.id].tracks ? 1 : 0), 0) + extra * EXTRA.track;
  const screens = chosen.reduce((a, w) => a + (w.screen && sel[w.id].screens ? 1 : 0), 0) + extra * EXTRA.screen;
  const counts = { interior: inside ? panes : 0, exterior: outside ? panes : 0, tracks, screens };
  const q = windowQuoteTotal(counts, book);
  const shown = useTicker(q.total);

  const allTracks = chosen.some((w) => w.track) && chosen.filter((w) => w.track).every((w) => sel[w.id].tracks);
  const allScreens = chosen.some((w) => w.screen) && chosen.filter((w) => w.screen).every((w) => sel[w.id].screens);
  const setAll = (k: 'tracks' | 'screens', v: boolean) => {
    const next: Record<string, Sel> = {};
    for (const [id, s] of Object.entries(sel)) next[id] = { ...s, [k]: v };
    setSel(next); buzz(8);
  };
  const toggleSide = (side: 'in' | 'out') => {
    // keep at least one side on
    if (side === 'in') { if (inside && !outside) return; setInside(!inside); }
    else { if (outside && !inside) return; setOutside(!outside); }
    buzz(8);
  };

  const lines: Line[] = [];
  for (const w of chosen) lines.push({ key: w.id, left: `${w.label} · ${w.panes} pane${w.panes > 1 ? 's' : ''}` });
  if (extra) lines.push({ key: 'extra', left: `Windows not shown ×${extra} · ${extra * EXTRA.panes} panes` });
  if (panes) {
    if (counts.exterior) lines.push({ key: 'ext', left: `Outside glass ${counts.exterior} × ${money(book.paneExterior)}`, right: money(counts.exterior * book.paneExterior) });
    if (counts.interior) lines.push({ key: 'int', left: `Inside glass ${counts.interior} × ${money(book.paneInterior)}`, right: money(counts.interior * book.paneInterior) });
    if (tracks) lines.push({ key: 'trk', left: `Tracks ${tracks} × ${money(book.track)}`, right: money(tracks * book.track) });
    if (screens) lines.push({ key: 'scr', left: `Screens ${screens} × ${money(book.screen)}`, right: money(screens * book.screen) });
    if (q.minimumApplied) lines.push({ key: 'min', left: `Visit minimum ${money(book.minimum)}`, muted: true });
  }

  const handoff = `/services?service=windows&street=1&int=${counts.interior}&ext=${counts.exterior}&tracks=${tracks}&screens=${screens}`;
  const activeWin = active ? WINDOWS.find((w) => w.id === active) : null;

  const Toggle = ({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={`min-h-[44px] flex-1 rounded-full px-3 text-[15px] font-semibold transition active:scale-95 disabled:opacity-40 ${on ? 'bg-[#15803D] text-white shadow-[0_4px_14px_rgba(21,128,61,0.35)]' : 'bg-white text-slate-800 ring-1 ring-black/10'}`}>
      {label}
    </button>
  );

  const ticket = (
    <div className="bs-ticket relative mx-auto w-full max-w-[380px] rounded-t-md bg-[#FFFDF8] px-5 pb-6 pt-4 font-mono text-[13px] tabular-nums text-slate-800 shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
      <div className="text-center text-[11px] uppercase tracking-[0.25em] text-slate-500">Buds At Work</div>
      <div className="text-center text-[15px] font-bold tracking-[0.12em]">YOUR VISIT</div>
      <div className="my-2 border-t border-dashed border-slate-400" />
      {lines.length === 0 ? (
        <p className="py-3 text-center text-slate-500">{zoomed ? 'Tap a window to add it.' : 'Tap the house to walk up.'}</p>
      ) : (
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l.key} className={`bs-line flex justify-between gap-3 ${l.muted ? 'text-slate-500' : ''}`}>
              <span className="truncate">{l.left}</span>{l.right && <span>{l.right}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="my-2 border-t border-dashed border-slate-400" />
      <div className="flex items-baseline justify-between text-[17px] font-bold">
        <span>ESTIMATE</span><span aria-live="polite" data-testid="street-total">{money(shown)}</span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500">Indicative, no GST. A Bud reviews every estimate. Oversized panes, heavily soiled windows and paint or hard-water stains are quoted on the day.</p>
      <button type="button" disabled={!panes} onClick={() => { setTorn(true); buzz(20); }}
        className="mt-3 min-h-[48px] w-full rounded-full bg-[#15803D] font-sans text-[16px] font-semibold text-white shadow-[0_6px_18px_rgba(21,128,61,0.3)] transition active:scale-[0.97] disabled:bg-slate-300 disabled:shadow-none">
        Tear off my estimate
      </button>
    </div>
  );

  return (
    <main className="bs-root relative flex min-h-[100dvh] w-full flex-col font-sans lg:grid lg:grid-cols-[1fr_420px]" style={{ background: PAPER }}>
      <style>{CSS}</style>
      <svg width="0" height="0" aria-hidden className="absolute">
        <filter id="bs-ink"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={4} /><feDisplacementMap in="SourceGraphic" scale={1.8} /></filter>
      </svg>

      <section className={`relative flex h-[calc(100dvh-140px)] min-h-[560px] flex-col lg:h-[calc(100dvh-100px)] lg:pb-0 ${zoomed ? '' : 'pb-[calc(126px+env(safe-area-inset-bottom))]'}`}>
        <header className="flex items-center justify-between px-5 pt-[max(16px,env(safe-area-inset-top))]">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">Buds Street</p>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900">{zoomed ? 'Tap the windows you want done' : 'Which windows need a clean?'}</h1>
          </div>
          {zoomed && <button type="button" onClick={() => setZoomed(false)} className="min-h-[44px] rounded-full px-4 text-[14px] font-medium text-slate-600 ring-1 ring-black/10">Street</button>}
        </header>

        <div ref={stageRef} className="relative mx-2 mt-2 min-h-[200px] flex-1 overflow-hidden rounded-3xl">
          <svg viewBox={(vb ?? target).join(' ')} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full touch-manipulation select-none"
            onClick={() => { if (!zoomed) setZoomed(true); }} role="img" aria-label="A hand-drawn Queenslander on Buds Street">
            <rect x={-600} y={-600} width={1600} height={830} fill="#EAF1F2" />
            <House sel={sel} active={active} onTap={tap} sparkle={sparkle} />
          </svg>
          {!zoomed && (
            <button type="button" onClick={() => setZoomed(true)} className="absolute bottom-4 left-1/2 min-h-[48px] -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-6 text-[16px] font-semibold text-slate-900 shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:scale-95">
              Walk up to the house →
            </button>
          )}
        </div>

        {zoomed && (
          <div className="space-y-2 px-4 pb-[calc(126px+env(safe-area-inset-bottom))] pt-3 lg:pb-6">
            {activeWin && sel[activeWin.id] ? (
              <div className="flex items-center gap-2 rounded-2xl bg-white p-2 pl-4 shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
                <p className="flex-1 text-[14px] font-medium text-slate-800">{activeWin.label} <span className="text-slate-500">· {activeWin.panes} pane{activeWin.panes > 1 ? 's' : ''}</span></p>
                {activeWin.track && <button type="button" aria-pressed={sel[activeWin.id].tracks} onClick={() => { setSel({ ...sel, [activeWin.id]: { ...sel[activeWin.id], tracks: !sel[activeWin.id].tracks } }); buzz(8); }} className={`min-h-[40px] rounded-full px-3 text-[13px] font-semibold ${sel[activeWin.id].tracks ? 'bg-[#DCFCE7] text-[#15803D]' : 'text-slate-500 ring-1 ring-black/10'}`}>Track</button>}
                {activeWin.screen && <button type="button" aria-pressed={sel[activeWin.id].screens} onClick={() => { setSel({ ...sel, [activeWin.id]: { ...sel[activeWin.id], screens: !sel[activeWin.id].screens } }); buzz(8); }} className={`min-h-[40px] rounded-full px-3 text-[13px] font-semibold ${sel[activeWin.id].screens ? 'bg-[#DCFCE7] text-[#15803D]' : 'text-slate-500 ring-1 ring-black/10'}`}>Screen</button>}
                <button type="button" aria-label="Remove window" onClick={() => tap(activeWin.id)} className="min-h-[40px] rounded-full px-3 text-[13px] text-slate-500 ring-1 ring-black/10">✕</button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Toggle on={outside} label="Outside" onClick={() => toggleSide('out')} />
              <Toggle on={inside} label="Inside" onClick={() => toggleSide('in')} />
              <Toggle on={allTracks} label="Tracks" disabled={!chosen.some((w) => w.track)} onClick={() => setAll('tracks', !allTracks)} />
              <Toggle on={allScreens} label="Screens" disabled={!chosen.some((w) => w.screen)} onClick={() => setAll('screens', !allScreens)} />
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.05)]">
              <p className="text-[14px] text-slate-700">Add a window not shown<span className="block text-[12px] text-slate-500">Counted as a 2-pane slider</span></p>
              <div className="flex items-center gap-3">
                <button type="button" aria-label="One fewer window" onClick={() => { setExtra(Math.max(0, extra - 1)); buzz(6); }} className="h-11 w-11 rounded-full text-xl ring-1 ring-black/10 active:scale-90">−</button>
                <span className="w-5 text-center text-[17px] font-semibold tabular-nums">{extra}</span>
                <button type="button" aria-label="One more window" onClick={() => { setExtra(extra + 1); buzz(10); }} className="h-11 w-11 rounded-full bg-[#15803D] text-xl text-white active:scale-90">+</button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ticket: bottom sheet on mobile, side column on desktop */}
      <aside className={`bs-sheet fixed inset-x-0 bottom-0 z-30 transition-transform duration-500 lg:static lg:flex lg:items-center lg:justify-center lg:p-8 lg:!translate-y-0 ${sheetOpen ? 'translate-y-0' : 'translate-y-[calc(100%-118px-env(safe-area-inset-bottom))]'}`}>
        <div className="max-h-[80dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-[#EFE8DA] px-3 pb-[env(safe-area-inset-bottom)] pt-2 shadow-[0_-10px_30px_rgba(0,0,0,0.12)] lg:max-h-none lg:w-full lg:rounded-3xl lg:bg-transparent lg:shadow-none">
          <button type="button" onClick={() => setSheetOpen(!sheetOpen)} aria-expanded={sheetOpen} className="flex w-full flex-col items-center pb-2 lg:hidden">
            <span className="h-1.5 w-10 rounded-full bg-black/20" />
            <span className="mt-2 flex w-full items-baseline justify-between px-3 text-[15px] font-semibold text-slate-900">
              <span>Your visit · {panes} pane{panes === 1 ? '' : 's'}</span><span className="font-mono tabular-nums">{money(shown)}</span>
            </span>
          </button>
          {ticket}
        </div>
      </aside>

      {torn && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 pb-[max(16px,env(safe-area-inset-bottom))] sm:items-center" onClick={() => setTorn(false)}>
          <div className="bs-card w-full max-w-[380px] rounded-3xl bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#15803D]">Your estimate</p>
            <p className="mt-1 font-mono text-[40px] font-bold tabular-nums tracking-tight text-slate-900">{money(q.total)}</p>
            <p className="text-[14px] text-slate-600">{panes} pane{panes === 1 ? '' : 's'}{outside && inside ? ', inside and out' : outside ? ', outside' : ', inside'}{tracks ? ` · ${tracks} track${tracks > 1 ? 's' : ''}` : ''}{screens ? ` · ${screens} screen${screens > 1 ? 's' : ''}` : ''}</p>
            <p className="mt-4 text-[17px] font-semibold text-slate-900">A Bud will be in touch.</p>
            <p className="mt-1 text-[13px] leading-snug text-slate-500">Send it through and we&apos;ll carry your windows into the booking form. A Bud reviews every estimate; oversized, soiled or stained glass is quoted on the day.</p>
            <Link href={handoff} onClick={() => buzz(16)} className="mt-5 flex min-h-[52px] items-center justify-center rounded-full bg-[#15803D] text-[17px] font-semibold text-white shadow-[0_8px_22px_rgba(21,128,61,0.35)] active:scale-[0.97]">
              Send to a Bud
            </Link>
            <button type="button" onClick={() => setTorn(false)} className="mt-2 min-h-[44px] w-full text-[14px] font-medium text-slate-500">Keep tapping</button>
          </div>
        </div>
      )}
    </main>
  );
}

const CSS = `
.bs-root{font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.bs-root .font-mono{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace}
.bs-hit{cursor:pointer;outline:none;transition:transform .15s}
.bs-hit:active{transform:scale(.96)}
.bs-hit:focus-visible{stroke:${GREEN};stroke-width:1}
.bs-glow{filter:drop-shadow(0 0 3px rgba(21,128,61,.6));animation:bsPulse 2.4s ease-in-out infinite}
.bs-tree{transform-origin:52px 228px;animation:bsSway 6s ease-in-out infinite}
.bs-cloud{animation:bsDrift 38s linear infinite}
.bs-cloud2{animation:bsDrift 60s linear infinite reverse}
.bs-light{opacity:0;mix-blend-mode:multiply;animation:bsLight 14s ease-in-out infinite}
.bs-sun{animation:bsSun 14s ease-in-out infinite}
.bs-squeegee{animation:bsWipe .55s ease-out forwards}
.bs-sparkle path{transform-box:fill-box;transform-origin:center;animation:bsSpark .7s ease-out forwards}
.bs-line{animation:bsType .45s steps(22,end) both}
.bs-ticket{background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.018) 0 1px,transparent 1px 3px);}
.bs-ticket::after{content:'';position:absolute;left:0;right:0;bottom:-8px;height:8px;background:radial-gradient(circle at 6px 0,transparent 5px,#FFFDF8 5.5px) 0 0/12px 8px repeat-x;transform:scaleY(-1)}
.bs-card{animation:bsTear .5s cubic-bezier(.2,.9,.3,1.2) both}
@keyframes bsSway{0%,100%{transform:rotate(-.8deg)}50%{transform:rotate(.9deg)}}
@keyframes bsDrift{from{transform:translateX(-80px)}to{transform:translateX(460px)}}
@keyframes bsLight{0%,100%{opacity:0}50%{opacity:.14}}
@keyframes bsSun{0%,100%{opacity:.65}50%{opacity:.95}}
@keyframes bsPulse{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes bsWipe{from{transform:translateX(0)}to{transform:translateX(70px)}}
@keyframes bsSpark{0%{transform:scale(0) rotate(0);opacity:1}60%{transform:scale(1.3) rotate(45deg);opacity:1}100%{transform:scale(.6) rotate(90deg);opacity:0}}
@keyframes bsType{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes bsTear{0%{transform:translateY(40px) rotate(-3deg);opacity:0}100%{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.bs-root *{animation:none!important;transition:none!important}.bs-light{opacity:0}}
`;
