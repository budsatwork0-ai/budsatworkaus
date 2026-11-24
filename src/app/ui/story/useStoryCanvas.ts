// Shared continuous-canvas scroll driver for art-directed "story" pages.
// Same behaviour as the home page's StoryScenes canvas (which keeps its own copy
// so the live home page is untouched); this version takes the hero selector so
// other routes (e.g. /get-involved behind GET_INVOLVED_STORY) can reuse it.
// A passive scroll listener + requestAnimationFrame writes CSS custom
// properties (--sc-bg / --sc-ink / --sc-acc on the canvas, --e / --p / --line /
// --x on [data-scrub] elements) so nothing re-renders per scroll pixel.

import type React from 'react';
import { useEffect } from 'react';

type RGB = [number, number, number];
export const TONES: Record<string, RGB> = {
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


export function useStoryCanvas(
  rootRef: React.RefObject<HTMLDivElement | null>,
  heroSelector = '[data-home-hero]',
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const canvas = (root.closest('[data-story-canvas]') as HTMLElement | null) ?? root;
    const header = document.querySelector('header') as HTMLElement | null;
    const hero = document.querySelector(heroSelector) as HTMLElement | null;
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
  }, [rootRef, heroSelector]);
}

