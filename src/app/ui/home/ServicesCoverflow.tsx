'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { COPY, type CarouselService } from './ServicesCarousel';

const GREEN = '#15803D';

const Arrow = ({ dir = 'right' }: { dir?: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={dir === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

// Coverflow: one large active card, smaller neighbours either side, transform-based.
export default function ServicesCoverflow({ services }: { services: CarouselService[] }) {
  const n = services.length;
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [wide, setWide] = useState(false);
  const drag = useRef<{ x: number; y: number; dx: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const md = window.matchMedia('(min-width: 768px)');
    const sync = () => { setReduce(mq.matches); setWide(md.matches); };
    sync();
    // Desktop opens on the second card so there are cards either side, like the mockup.
    if (md.matches) setActive(1);
    mq.addEventListener('change', sync);
    md.addEventListener('change', sync);
    return () => { mq.removeEventListener('change', sync); md.removeEventListener('change', sync); };
  }, []);

  const go = useCallback((i: number) => setActive(Math.max(0, Math.min(n - 1, i))), [n]);

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.dx = e.clientX - d.x;
    if (Math.abs(d.dx) > 8 && Math.abs(d.dx) > Math.abs(e.clientY - d.y)) d.moved = true;
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.moved) return;
    suppressClick.current = true;
    setTimeout(() => (suppressClick.current = false), 50);
    if (d.dx < -40) go(active + 1);
    else if (d.dx > 40) go(active - 1);
  };

  // Card geometry (px). Mobile: active ~66% of a 390 screen; desktop: bigger, more neighbours.
  const cardW = wide ? 300 : 258;
  const cardH = wide ? 400 : 340;
  const step = wide ? 285 : 214;

  return (
    <div className="mt-7">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Our services"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1); }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        className="relative mx-auto w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-green-600 rounded-[28px] select-none md:[mask-image:linear-gradient(to_right,transparent,black_7%,black_93%,transparent)]"
        style={{ height: cardH + 40, touchAction: 'pan-y' }}
      >
        {services.map((s, i) => {
          const c = COPY[s.key] ?? COPY.windows;
          const off = i - active;
          const abs = Math.abs(off);
          const scale = abs === 0 ? 1 : abs === 1 ? 0.84 : 0.7;
          const x = Math.sign(off) * (abs === 0 ? 0 : step + (abs - 1) * step * 0.78);
          const hidden = abs > (wide ? 2 : 1);
          const isActive = off === 0;
          return (
            <Link
              key={s.key}
              href={s.href}
              aria-label={isActive ? `${s.label}, get a quote` : `Show ${s.label}`}
              aria-hidden={hidden || undefined}
              tabIndex={hidden ? -1 : 0}
              draggable={false}
              onClick={(e) => {
                if (suppressClick.current || !isActive) { e.preventDefault(); if (!suppressClick.current) go(i); }
              }}
              className="absolute left-1/2 top-5 block overflow-hidden rounded-[24px] bg-neutral-200 shadow-[0_22px_44px_-20px_rgba(0,0,0,0.5)] outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              style={{
                width: cardW,
                height: cardH,
                marginLeft: -cardW / 2,
                transform: `translateX(${x}px) scale(${scale})`,
                zIndex: 10 - abs,
                opacity: hidden ? 0 : 1,
                filter: isActive ? undefined : `brightness(${abs === 1 ? 0.82 : 0.7})`,
                pointerEvents: hidden ? 'none' : undefined,
                transition: reduce ? 'none' : 'transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 400ms ease, filter 400ms ease',
              }}
            >
              <Image src={c.img} alt="" fill sizes="300px" className="object-cover pointer-events-none" draggable={false} />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 70%)' }} />
              <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/95 shadow-sm" style={{ color: GREEN }}>{s.icon}</span>
              <div className="absolute inset-x-4 bottom-4 text-white">
                <h3 className="text-[22px] font-semibold leading-[1.1]" style={{ letterSpacing: '-0.02em' }}>{s.label}</h3>
                <p className="mt-1.5 min-h-[2.5em] text-[13.5px] leading-snug text-white/85">{c.line}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[12.5px] text-white/80">From <span className="font-semibold text-white">${s.from}</span></span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-900"><Arrow /></span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">{`Service ${active + 1} of ${n}: ${services[active]?.label}`}</p>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button type="button" aria-label="Previous service" onClick={() => go(active - 1)} disabled={active === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-800 disabled:opacity-35 transition-opacity focus-visible:ring-2 focus-visible:ring-green-600 outline-none">
          <Arrow dir="left" />
        </button>
        <div className="flex items-center gap-1.5">
          {services.map((s, i) => (
            <button key={s.key} type="button" aria-label={`Show ${s.label}`} aria-current={i === active} onClick={() => go(i)}
              className="h-1.5 rounded-full transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-green-600"
              style={{ width: i === active ? 20 : 6, background: i === active ? GREEN : '#d4d4d4' }} />
          ))}
        </div>
        <button type="button" aria-label="Next service" onClick={() => go(active + 1)} disabled={active === n - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-800 disabled:opacity-35 transition-opacity focus-visible:ring-2 focus-visible:ring-green-600 outline-none">
          <Arrow />
        </button>
      </div>
    </div>
  );
}
