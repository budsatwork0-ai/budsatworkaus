'use client';

// Art-directed home scenes (HOME_HERO_SHEET_TRANSITION, preview only).
// One continuous canvas: a passive scroll listener + requestAnimationFrame writes
// CSS custom properties (no React re-renders per scroll pixel). The background
// tone glides between warm paper and deep eucalyptus, so no hard horizontal
// section edges ever cross the screen.

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Instrument_Serif } from 'next/font/google';
import ServicesCoverflow from './ServicesCoverflow';
import BeforeAfterSlider from './BeforeAfterSlider';
import type { CarouselService } from './ServicesCarousel';
import { HOME_FOUNDING_STORY } from './flags';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], display: 'swap', preload: false });

const SANS = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const MONO_STACK = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

// One type family across the home page (24 Nov 2026, Jackson's request): Inter, the
// same face as the hero headline, header and the rest of the public site. Headlines
// use the hero's semibold + tight tracking; accents are colour only. Set false to
// bring back the Instrument Serif headline + monospace label pairing.
const STORY_UNIFIED_FONT = true;
const MONO = STORY_UNIFIED_FONT ? SANS : MONO_STACK;
const IT = STORY_UNIFIED_FONT ? '' : 'italic';
// Headline class: unified (Inter) size/weight vs the serif original.
const headline = (serifSize: string, sansSize: string) =>
  STORY_UNIFIED_FONT ? `font-semibold ${sansSize}` : `${serif.className} ${serifSize}`;
const track = (serifTrack: string) => (STORY_UNIFIED_FONT ? '-0.035em' : serifTrack);

type RGB = [number, number, number];
const TONES: Record<string, RGB> = {
  dark: [11, 26, 18],
  paper: [247, 245, 240],
  linen: [240, 236, 227],
};
const INK_PAPER: RGB = [18, 26, 21];
const INK_DARK: RGB = [243, 240, 232];
const ACC_PAPER: RGB = [28, 124, 84];
const ACC_DARK: RGB = [143, 217, 174];

const lerp = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// Dark <-> light passes through a eucalyptus mid-tone instead of flat grey.
const MID: RGB = [92, 124, 104];
const mix = (a: RGB, b: RGB, t: number): RGB => {
  const da = a[1] < 60, db = b[1] < 60;
  if (da === db) return lerp(a, b, t);
  return t < 0.5 ? lerp(a, MID, t * 2) : lerp(MID, b, (t - 0.5) * 2);
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const rgbStr = (c: RGB) => `${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])}`;

const INK = 'rgb(var(--sc-ink))';
const INK_SOFT = 'rgb(var(--sc-ink) / 0.64)';
const INK_FAINT = 'rgb(var(--sc-ink) / 0.4)';
const ACC = 'rgb(var(--sc-acc))';
const HAIR = 'rgb(var(--sc-ink) / 0.14)';
const v = (o: Record<string, string | number>) => o as React.CSSProperties;
// Scene text dissolves out/in around tone changes so nothing sits on the mid-tone.
const ENTER = 'clamp(0, calc((var(--e) - 0.62) * 2.8), 1)';
const EXIT = 'var(--x)';

function useStoryCanvas(rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const canvas = (root.closest('[data-story-canvas]') as HTMLElement | null) ?? root;
    const header = document.querySelector('header') as HTMLElement | null;
    const hero = document.querySelector('[data-home-hero]') as HTMLElement | null;
    const heroMedia = document.querySelector('[data-hero-media]') as HTMLElement | null;
    const heroCopy = document.querySelector('[data-hero-copy]') as HTMLElement | null;
    const heroCue = document.querySelector('[data-hero-cue]') as HTMLElement | null;
    const heroDim = document.querySelector('[data-hero-dim]') as HTMLElement | null;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    let segs: { top: number; bottom: number; c: RGB }[] = [];
    let scrubs: { el: HTMLElement; top: number; h: number; last: string }[] = [];
    let heroBottom = 0;
    let lastCanvas = '';
    let lastDark: boolean | null = null;
    let raf = 0;

    const measure = () => {
      const y = window.scrollY;
      const list: { top: number; bottom: number; c: RGB }[] = [];
      if (hero) {
        const r = hero.getBoundingClientRect();
        heroBottom = r.bottom + y;
        list.push({ top: r.top + y, bottom: r.bottom + y, c: TONES.dark });
      }
      root.querySelectorAll<HTMLElement>('[data-tone]').forEach((el) => {
        const r = el.getBoundingClientRect();
        list.push({ top: r.top + y, bottom: r.bottom + y, c: TONES[el.dataset.tone ?? 'paper'] ?? TONES.paper });
      });
      segs = list;
      scrubs = Array.from(root.querySelectorAll<HTMLElement>('[data-scrub]')).map((el) => {
        const r = el.getBoundingClientRect();
        return { el, top: r.top + y, h: r.height, last: '' };
      });
    };

    const frame = () => {
      raf = 0;
      const y = window.scrollY;
      const vh = window.innerHeight;
      const still = reduce.matches;

      // Continuous canvas tone at the viewport's optical centre.
      const m = y + vh * 0.5;
      const band = vh * 0.3;
      let c: RGB = segs[0]?.c ?? TONES.dark;
      let idx = 0;
      while (idx + 1 < segs.length && segs[idx + 1].top <= m) idx++;
      const cur = segs[idx];
      if (cur) {
        c = cur.c;
        const next = segs[idx + 1];
        const prev = segs[idx - 1];
        if (next && m > next.top - band) c = mix(cur.c, next.c, smooth(next.top - band, next.top + band, m));
        else if (prev && m < cur.top + band) c = mix(prev.c, cur.c, smooth(cur.top - band, cur.top + band, m));
      }
      const d = clamp01((TONES.paper[1] - c[1]) / (TONES.paper[1] - TONES.dark[1]));
      const inkT = smooth(0.32, 0.68, d);
      const canvasKey = rgbStr(c);
      if (canvasKey !== lastCanvas) {
        lastCanvas = canvasKey;
        canvas.style.setProperty('--sc-bg', canvasKey);
        canvas.style.setProperty('--sc-ink', rgbStr(lerp(INK_PAPER, INK_DARK, inkT)));
        canvas.style.setProperty('--sc-acc', rgbStr(lerp(ACC_PAPER, ACC_DARK, inkT)));
        header?.style.setProperty('--home-canvas', canvasKey);
      }
      const dark = y < heroBottom - 72 || d > 0.5;
      if (dark !== lastDark) {
        lastDark = dark;
        window.dispatchEvent(new CustomEvent('home:header-tone', { detail: { dark } }));
      }

      // Opening film: gentle depth as the canvas rises.
      if (y < vh * 1.4) {
        const p = clamp01(y / vh);
        if (heroMedia) heroMedia.style.transform = still ? '' : `translate3d(0, ${(y * 0.35).toFixed(1)}px, 0) scale(${(1 + p * 0.07).toFixed(4)})`;
        if (heroCopy) {
          heroCopy.style.transform = still ? '' : `translate3d(0, ${(-y * 0.18).toFixed(1)}px, 0)`;
          heroCopy.style.opacity = still ? '' : String(clamp01(1 - p * 1.5).toFixed(3));
        }
        if (heroCue) heroCue.style.opacity = still ? '' : String(clamp01(1 - p * 5).toFixed(3));
        if (heroDim) heroDim.style.opacity = String((p * 0.75).toFixed(3));
      }

      // Per-scene progress variables.
      for (const s of scrubs) {
        let e = 1, p = 1, line = 1, x = 1;
        if (!still) {
          const rel = s.top - y;
          x = clamp01((rel + s.h - vh * 0.48) / (vh * 0.42));
          e = clamp01((vh - rel) / (vh * 0.75));
          p = clamp01((y - s.top) / Math.max(1, s.h - vh));
          line = clamp01((y + vh * 0.62 - s.top) / Math.max(1, s.h));
        }
        const key = `${e.toFixed(3)}|${p.toFixed(3)}|${line.toFixed(3)}|${x.toFixed(3)}`;
        if (key === s.last) continue;
        s.last = key;
        s.el.style.setProperty('--e', e.toFixed(3));
        s.el.style.setProperty('--p', p.toFixed(3));
        s.el.style.setProperty('--line', line.toFixed(3));
        s.el.style.setProperty('--x', x.toFixed(3));
      }
    };

    const schedule = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const remeasure = () => { measure(); schedule(); };

    measure();
    frame();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure, { passive: true });
    window.addEventListener('load', remeasure);
    reduce.addEventListener('change', remeasure);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(remeasure) : null;
    ro?.observe(root);
    if (hero) ro?.observe(hero);
    document.fonts?.ready.then(remeasure).catch(() => {});

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      window.removeEventListener('load', remeasure);
      reduce.removeEventListener('change', remeasure);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      header?.style.removeProperty('--home-canvas');
      window.dispatchEvent(new CustomEvent('home:header-tone', { detail: { dark: false } }));
    };
  }, [rootRef]);
}

function Label({ n, children, className = '' }: { n: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] ${className}`} style={{ fontFamily: MONO, color: INK_SOFT }}>
      <span style={{ color: ACC }}>{n}</span>
      <span aria-hidden className="h-px w-8" style={{ background: HAIR }} />
      {children}
    </p>
  );
}

// ── Scene 2: manifesto, scroll-scrubbed word illumination ────────────────────
type ManifestoWord = { w: string; accent?: boolean; note?: boolean };

function manifestoWords(src: string): ManifestoWord[] {
  return src.split(/\s+/).reduce<ManifestoWord[]>((acc, raw) => {
    if (raw === '|note') { acc[acc.length - 1].note = true; return acc; }
    if (raw.startsWith('|')) acc.push({ w: raw.replace(/\|/g, ''), accent: true });
    else acc.push({ w: raw });
    return acc;
  }, []);
}

// Original copy. Restored automatically when HOME_FOUNDING_STORY is off.
const MANIFESTO_ORIGINAL = manifestoWords(
  "We're a small crew from Logan. |note We show up when we say we will, quote prices that mean something, and take |pride| in every window, yard and home we touch."
);

// Founding story (24 Nov 2026, Jackson's request): Jacko as founder, Silvan as
// the reason the company exists. ¹ sits after "keeping."; accent on "Silvan".
const MANIFESTO_FOUNDING = manifestoWords(
  "It started with one support worker and one mate who wanted a job worth keeping. |note So we built the kind of work that makes room for people like |Silvan|, and every window, yard and home we take on keeps that door open."
);

function Manifesto() {
  const MANIFESTO = HOME_FOUNDING_STORY ? MANIFESTO_FOUNDING : MANIFESTO_ORIGINAL;
  const footnote = HOME_FOUNDING_STORY
    ? 'Founded by Jackson Taylor to create real jobs for people with disabilities.'
    : 'Working across Logan & South Brisbane. Insured · Vetted crew · NDIS-ready.';
  const n = MANIFESTO.length;
  const k = (n + 3) / 0.78;
  return (
    <section data-tone="dark" data-scrub aria-label="Who we are" className="relative" style={v({ height: '210svh', '--p': 1, '--e': 1, '--x': 1 })}>
      <div className="sticky top-0 mx-auto flex h-[100svh] max-w-7xl flex-col justify-between px-6 pb-10 pt-28 md:px-16 md:pb-14 md:pt-36" style={{ opacity: EXIT }}>
        <Label n="I">Who we are</Label>
        <h2
          className={`${STORY_UNIFIED_FONT ? 'font-medium text-[clamp(1.9rem,7.7vw,4.2rem)] leading-[1.14]' : `${serif.className} text-[clamp(2.55rem,10.4vw,5.6rem)] leading-[1.04]`} max-w-[17ch] md:max-w-[22ch]`}
          style={{ color: INK, letterSpacing: STORY_UNIFIED_FONT ? '-0.03em' : '-0.012em' }}
        >
          {MANIFESTO.map((t, i) => (
            <React.Fragment key={i}>
              <span
                className={t.accent && IT ? IT : undefined}
                style={{
                  color: t.accent ? ACC : undefined,
                  opacity: `clamp(0.16, calc((var(--p) * ${k.toFixed(3)} - ${i}) * 0.5 + 0.16), 1)`,
                }}
              >
                {t.w}
                {t.note && <sup className="ml-0.5 align-super text-[0.38em]" style={{ fontFamily: MONO, color: ACC }}>1</sup>}
              </span>{' '}
            </React.Fragment>
          ))}
        </h2>
        <p
          className="max-w-md text-[12.5px] leading-relaxed md:text-[13px]"
          style={{ fontFamily: MONO, color: INK_SOFT, opacity: 'clamp(0, calc(var(--p) * 2.2 - 1.1), 1)' }}
        >
          <span style={{ color: ACC }}>1</span>&nbsp; {footnote}
        </p>
      </div>
    </section>
  );
}

// ── Scene 3: the craft ───────────────────────────────────────────────────────
function Craft({ services }: { services: CarouselService[] }) {
  const [active, setActive] = useState(0);
  const pad = (x: number) => String(x).padStart(2, '0');
  return (
    <section data-tone="paper" data-scrub aria-label="What we do" className="relative pb-[16svh] pt-[22svh] md:pt-[26svh]" style={v({ '--e': 1 })}>
      <div className="mx-auto grid max-w-7xl gap-y-6 px-6 md:grid-cols-12 md:px-16" style={{ opacity: ENTER }}>
        <Label n="II" className="md:col-span-12">What we do</Label>
        <h2
          className={`${headline('text-[clamp(3.1rem,14vw,7.5rem)] leading-[0.94]', 'text-[clamp(2.4rem,10vw,5.5rem)] leading-[1.03]')} md:col-span-8`}
          style={{ color: INK, letterSpacing: track('-0.02em'), transform: 'translate3d(0, calc((1 - var(--e)) * 40px), 0)' }}
        >
          Practical help,<br />
          <span className={IT || undefined} style={{ color: ACC }}>done properly.</span>
        </h2>
        <div className="flex items-end justify-between gap-6 md:col-span-4 md:flex-col md:items-end md:justify-end md:text-right">
          <p className="max-w-[16rem] text-[15px] leading-relaxed" style={{ color: INK_SOFT, fontFamily: SANS }}>
            Practical services to make your life easier, priced upfront.
          </p>
          <p className="shrink-0 tabular-nums text-[13px] tracking-[0.12em]" style={{ fontFamily: MONO, color: INK_FAINT }} aria-hidden>
            <span style={{ color: INK }}>{pad(active + 1)}</span> / {pad(services.length)}
          </p>
        </div>
      </div>
      <div
        className="mt-[7svh] w-full"
        style={{
          transform: 'translate3d(0, calc((1 - var(--e)) * 70px), 0) scale(calc(0.95 + var(--e) * 0.05))',
          opacity: 'calc(0.2 + var(--e) * 0.8)',
          fontFamily: SANS,
        }}
      >
        <ServicesCoverflow services={services} onActiveChange={setActive} />
      </div>
    </section>
  );
}

// ── Scene 4: the proof ───────────────────────────────────────────────────────
function Proof({ hd }: { hd: boolean }) {
  return (
    <section data-tone="linen" aria-label="See the difference" className="relative py-[14svh] md:py-[18svh]">
      <div className="mx-auto grid max-w-7xl items-center gap-y-8 px-4 md:grid-cols-12 md:gap-x-10 md:px-16">
        <div className="px-2 md:col-span-5 md:px-0">
          <Label n="III">The proof</Label>
          <h2 className={`${headline('text-[clamp(2.9rem,13vw,6.6rem)] leading-[0.95]', 'text-[clamp(2.4rem,10.5vw,5.2rem)] leading-[1.03]')} mt-8`} style={{ color: INK, letterSpacing: track('-0.02em') }}>
            Before<br />we arrive.
          </h2>
          <h2
            className={`${headline('text-[clamp(2.9rem,13vw,6.6rem)] italic leading-[0.95]', 'text-[clamp(2.4rem,10.5vw,5.2rem)] leading-[1.03]')} mt-3 hidden md:block`}
            style={{ color: ACC, letterSpacing: track('-0.02em') }}
          >
            After<br />we leave.
          </h2>
          <div className="mt-10 hidden md:block">
            <p className="max-w-xs text-[15px] leading-relaxed" style={{ color: INK_SOFT, fontFamily: SANS }}>A recent window clean by the Buds. Drag the line to compare.</p>
            <Link href="/services?service=windows" data-track="homepage_proof_window_quote_click" className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium" style={{ color: ACC, fontFamily: SANS }}>
              Get a window quote <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
        <div
          data-scrub
          className="md:col-span-7"
          style={v({ '--e': 1, transform: 'scale(calc(0.92 + var(--e) * 0.08))', transformOrigin: '50% 30%', fontFamily: SANS })}
        >
          <BeforeAfterSlider
            before={hd
              ? { src: '/images/window-clean-before-hd.webp', alt: 'Dirty, streaky verandah window before a Buds At Work clean' }
              : { src: '/images/window-clean-before.webp', alt: 'Window before a Buds At Work window clean' }}
            after={hd
              ? { src: '/images/window-clean-after-hd.webp', alt: 'The same verandah window sparkling clean after a Buds At Work clean' }
              : { src: '/images/window-clean-after.webp', alt: 'Window after a Buds At Work window clean' }}
          />
        </div>
        <div className="px-2 text-right md:hidden">
          <h2 className={headline('text-[clamp(2.9rem,13vw,6.6rem)] italic leading-[0.95]', 'text-[clamp(2.4rem,10.5vw,5.2rem)] leading-[1.03]')} style={{ color: ACC, letterSpacing: track('-0.02em') }}>
            After<br />we leave.
          </h2>
          <Link href="/services?service=windows" data-track="homepage_proof_window_quote_click" className="mt-6 inline-flex items-center gap-2 text-[15px] font-medium" style={{ color: ACC, fontFamily: SANS }}>
            Get a window quote <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Scene 5: the rhythm ──────────────────────────────────────────────────────
type Step = { n: string; title: string; body: string };
function Rhythm({ steps }: { steps: Step[] }) {
  const count = steps.length;
  return (
    <section data-tone="paper" data-scrub aria-label="How it works" className="relative pb-[20svh] pt-[16svh]" style={v({ '--e': 1, '--x': 1 })}>
      <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: EXIT }}>
        <div className="grid gap-y-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-8">
            <Label n="IV">How it works</Label>
            <h2 className={`${headline('text-[clamp(2.9rem,12.5vw,6.8rem)] leading-[0.95]', 'text-[clamp(2.4rem,10.5vw,5.4rem)] leading-[1.03]')} mt-8`} style={{ color: INK, letterSpacing: track('-0.02em') }}>
              Quoting that<br /><span className={IT || undefined} style={{ color: ACC }}>makes sense.</span>
            </h2>
          </div>
          <p className="text-[15px] md:col-span-4 md:text-right" style={{ color: INK_SOFT, fontFamily: SANS }}>No callbacks, no guesswork.</p>
        </div>

        <ol data-scrub className="relative mt-[12svh] pl-7 md:mt-[16svh] md:pl-0" style={v({ '--line': 1 })}>
          <span aria-hidden className="absolute bottom-0 left-0 top-0 w-px md:left-[calc(25%-1px)]" style={{ background: HAIR }} />
          <span
            aria-hidden
            className="absolute bottom-0 left-0 top-0 w-px origin-top md:left-[calc(25%-1px)]"
            style={{ background: ACC, transform: 'scaleY(var(--line))' }}
          />
          {steps.map((s, i) => (
            <li key={s.n} className={`grid md:grid-cols-12 ${i ? 'mt-[11svh] md:mt-[14svh]' : ''}`}>
              <span
                className={`${STORY_UNIFIED_FONT ? 'font-normal text-[clamp(4.25rem,21vw,8.5rem)] leading-[0.85]' : `${serif.className} text-[clamp(5rem,26vw,9.5rem)] leading-[0.8]`} block tabular-nums md:col-span-3`}
                style={{
                  color: INK,
                  letterSpacing: STORY_UNIFIED_FONT ? '-0.05em' : undefined,
                  opacity: `clamp(0.14, calc((var(--line) * ${count + 0.6} - ${i}) * 0.9), 1)`,
                }}
                aria-hidden
              >
                {s.n}
              </span>
              <div className={`mt-5 md:col-span-6 md:mt-3 md:pl-12 ${i === 1 ? 'md:col-start-6' : i === 2 ? 'md:col-start-7' : 'md:col-start-4'}`}>
                <h3 className="text-[24px] font-semibold leading-tight md:text-[28px]" style={{ color: INK, letterSpacing: '-0.025em', fontFamily: SANS }}>
                  <span className="sr-only">{`Step ${s.n}: `}</span>{s.title}
                </h3>
                <p className="mt-3 max-w-md text-[16px] leading-relaxed" style={{ color: INK_SOFT, fontFamily: SANS }}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Scene 6: the people + finale ─────────────────────────────────────────────
function Crew({ promises }: { promises: string[] }) {
  return (
    <section data-tone="dark" data-scrub aria-label="Your local crew" className="relative pb-[18svh] pt-[24svh]" style={v({ '--e': 1, '--x': 1 })}>
      <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: `min(${ENTER}, ${EXIT})` }}>
        <Label n="V">The crew</Label>
        <h2 className={`${headline('text-[clamp(3.2rem,14.5vw,8.6rem)] leading-[0.92]', 'text-[clamp(2.5rem,10.8vw,6.4rem)] leading-[1.03]')} mt-10`} style={{ color: INK, letterSpacing: track('-0.025em') }}>
          Your local crew,
          <span className={`mt-2 block ${IT} md:pl-[18%]`} style={{ color: ACC }}>not a faceless platform.</span>
        </h2>
        <div className="mt-[10svh] grid gap-y-10 md:grid-cols-12">
          <p className="max-w-sm text-[17px] leading-relaxed md:col-span-4" style={{ color: INK_SOFT, fontFamily: SANS }}>
            A small team based in Logan. Real people who take pride in the work.
          </p>
          <ul className="md:col-span-7 md:col-start-6" style={{ fontFamily: SANS }}>
            {promises.map((p, i) => (
              <li key={p} className="flex items-baseline gap-5 border-t py-5 text-[18px] md:text-[20px]" style={{ borderColor: HAIR, color: INK }}>
                <span className="w-6 shrink-0 text-[11px] tabular-nums tracking-[0.15em]" style={{ fontFamily: MONO, color: ACC }}>{String(i + 1).padStart(2, '0')}</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-10 md:ml-[calc(41.666%+0.5rem)]">
          <Link href="/about" className="inline-flex items-center gap-2 text-[16px] font-medium" style={{ color: INK, fontFamily: SANS }}>
            Meet the Buds <span aria-hidden style={{ color: ACC }}>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Finale({ ctaRef, accent }: { ctaRef: React.RefObject<HTMLDivElement | null>; accent: string }) {
  return (
    <section data-tone="paper" data-scrub aria-label="Book a service" style={v({ '--e': 1 })} className="relative flex min-h-[112svh] flex-col items-center justify-center px-6 pb-[16svh] pt-[22svh] text-center">
      <div ref={ctaRef} className="relative z-10 flex flex-col items-center" style={{ opacity: ENTER, transform: 'translate3d(0, calc((1 - var(--e)) * 40px), 0)' }}>
        <h2 className={headline('text-[clamp(3.6rem,17vw,11rem)] leading-[0.9]', 'text-[clamp(2.9rem,13vw,8rem)] leading-[1.0]')} style={{ color: INK, letterSpacing: track('-0.03em') }}>
          Ready when<br /><span className={IT || undefined} style={{ color: ACC }}>you are.</span>
        </h2>
        <p className="mt-8 max-w-xs text-[17px] leading-relaxed md:max-w-md" style={{ color: INK_SOFT, fontFamily: SANS }}>
          Build your free quote in minutes. Price locked for 7 days.
        </p>
        <Link
          href="/services"
          data-track="final_quote_click"
          data-track-label="Homepage final quote"
          className="mt-12 inline-flex items-center rounded-full px-9 py-4 text-[16px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: accent, boxShadow: '0 10px 30px -8px rgba(28,124,84,0.55)', fontFamily: SANS }}
        >
          Book a service
        </Link>
        <p className="mt-5 text-[12px] uppercase tracking-[0.18em]" style={{ color: INK_FAINT, fontFamily: MONO }}>No payment until you confirm</p>
      </div>
      {/* Soft hand-off into the footer's white. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[22svh]" style={{ background: 'linear-gradient(to bottom, rgb(var(--sc-bg) / 0), #fff)' }} />
    </section>
  );
}

export default function StoryScenes({
  ctaRef,
  services,
  steps,
  promises,
  hd,
  accent,
}: {
  ctaRef: React.RefObject<HTMLDivElement | null>;
  services: CarouselService[];
  steps: Step[];
  promises: string[];
  hd: boolean;
  accent: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useStoryCanvas(rootRef);
  return (
    <div
      ref={rootRef}
      data-story-home
      className="relative z-10 -mb-20 md:-mb-10"
      style={{
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        width: '100vw',
        background: 'rgb(var(--sc-bg))',
        color: INK,
        fontFamily: SANS,
      }}
    >
      {/* Sticky scenes need a non-scrolling overflow clip on the page shell. */}
      <style>{'html:has([data-story-home]),body:has([data-story-home]),div:has(> main [data-story-home]){overflow-x:clip}'}</style>
      <Manifesto />
      <Craft services={services} />
      <Proof hd={hd} />
      <Rhythm steps={steps} />
      <Crew promises={promises} />
      <Finale ctaRef={ctaRef} accent={accent} />
    </div>
  );
}
