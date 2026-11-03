'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type CarouselService = { key: string; label: string; href: string; from: number | string; icon: React.ReactNode };

const GREEN = '#15803D';

const COPY: Record<string, { img: string; line: string }> = {
  windows: { img: '/images/window-clean-after-hd.webp', line: 'Crystal-clear windows, inside and out.' },
  cleaning: { img: '/images/services/home-cleaning.webp', line: 'A fresh, tidy home, with less effort.' },
  yard: { img: '/images/services/yard-garden.webp', line: 'Tidy outdoor spaces, all year round.' },
  dump: { img: '/images/services/dump-runs.webp', line: 'Junk gone, without the trailer hire.' },
  auto: { img: '/images/services/car-detailing.webp', line: 'A showroom finish, at your place.' },
  laundry: { img: '/images/services/laundry-sneakers.webp', line: 'Fresh clothes and clean kicks, sorted.' },
};

const Arrow = ({ dir = 'right' }: { dir?: 'left' | 'right' }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={dir === 'left' ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function ServicesCarousel({ services }: { services: CarouselService[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = () => setReduce(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Scroll-driven scale/dim, batched per frame.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const c = el.offsetLeft + el.offsetWidth / 2;
        const d = Math.abs(c - mid);
        if (d < bestD) { bestD = d; best = i; }
        const t = Math.min(1, d / el.offsetWidth);
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) {
          inner.style.transform = reduce ? '' : `scale(${1 - 0.1 * t})`;
          inner.style.filter = reduce ? '' : `brightness(${1 - 0.18 * t})`;
        }
      });
      setActive(best);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      track.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  // Desktop: open on the second card so cards flank the centre, like the mockup.
  useEffect(() => {
    const track = trackRef.current, el = cardRefs.current[1];
    if (!track || !el || window.innerWidth < 768) return;
    track.scrollLeft = el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2;
  }, []);

  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const el = cardRefs.current[Math.max(0, Math.min(services.length - 1, i))];
    if (!track || !el) return;
    track.scrollTo({ left: el.offsetLeft - (track.clientWidth - el.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [reduce, services.length]);

  return (
    <div className="mt-6 [@media(max-height:700px)]:mt-4">
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label="Our services"
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain py-3 md:[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch', paddingInline: 'calc(50% - min(36vw, 135px))' }}
      >
        {services.map((s, i) => {
          const c = COPY[s.key] ?? COPY.windows;
          return (
            <div
              key={s.key}
              ref={(el) => { cardRefs.current[i] = el; }}
              className="shrink-0 snap-center px-1.5 md:px-2.5"
              style={{ width: 'min(72vw, 270px)' }}
              aria-label={`${i + 1} of ${services.length}`}
            >
              <div className="will-change-transform transition-[filter] duration-150" style={{ transformOrigin: 'center' }}>
                <Link
                  href={s.href}
                  className="group relative block overflow-hidden rounded-[24px] bg-neutral-200 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)] active:scale-[0.98] transition-transform"
                  style={{ height: 'min(calc(min(72vw, 270px) * 1.3), calc(100svh - 380px))', minHeight: 240 }}
                >
                  <Image src={c.img} alt="" fill sizes="(max-width: 768px) 72vw, 270px" className="object-cover" draggable={false} />
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 70%)' }} />
                  <span className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/95 shadow-sm" style={{ color: GREEN }}>{s.icon}</span>
                  <div className="absolute inset-x-4 bottom-4 text-white">
                    <h3 className="text-[22px] font-semibold leading-[1.1]" style={{ letterSpacing: '-0.02em' }}>{s.label}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-snug text-white/85">{c.line}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-[12.5px] text-white/80">From <span className="font-semibold text-white">${s.from}</span></span>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-900"><Arrow /></span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-4">
        <button type="button" aria-label="Previous service" onClick={() => goTo(active - 1)} disabled={active === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-800 disabled:opacity-35 transition-opacity">
          <Arrow dir="left" />
        </button>
        <div className="flex items-center gap-1.5">
          {services.map((s, i) => (
            <button key={s.key} type="button" aria-label={`Show ${s.label}`} aria-current={i === active} onClick={() => goTo(i)}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: i === active ? 20 : 6, background: i === active ? GREEN : '#d4d4d4' }} />
          ))}
        </div>
        <button type="button" aria-label="Next service" onClick={() => goTo(active + 1)} disabled={active === services.length - 1}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-800 disabled:opacity-35 transition-opacity">
          <Arrow />
        </button>
      </div>
    </div>
  );
}
