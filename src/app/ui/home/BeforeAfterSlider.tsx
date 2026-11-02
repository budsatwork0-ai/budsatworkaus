'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

type Photo = { src: string; alt: string };

export default function BeforeAfterSlider({ before, after }: { before: Photo; after: Photo }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; active: boolean; decided: boolean } | null>(null);
  const anim = useRef<number | null>(null);
  const played = useRef(false);

  const stopAnim = useCallback(() => {
    if (anim.current !== null) { cancelAnimationFrame(anim.current); clearTimeout(anim.current); }
    anim.current = null;
  }, []);

  const setFromX = useCallback((clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }, []);

  // One-time hint sweep 50 -> 85 -> 50 when first in view.
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || played.current) return;
        played.current = true;
        io.disconnect();
        const dur = 1400;
        let start: number | null = null;
        const ease = (t: number) => 0.5 - Math.cos(Math.PI * t) / 2;
        const step = (ts: number) => {
          if (start === null) start = ts;
          const t = Math.min(1, (ts - start) / dur);
          setPos(50 + 35 * Math.sin(Math.PI * ease(t)));
          anim.current = t < 1 ? requestAnimationFrame(step) : null;
        };
        anim.current = window.setTimeout(() => {
          anim.current = requestAnimationFrame(step);
        }, 300) as unknown as number;
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      stopAnim();
    };
  }, [stopAnim]);

  const onPointerDown = (e: React.PointerEvent) => {
    stopAnim();
    drag.current = { x: e.clientX, y: e.clientY, active: e.pointerType === 'mouse', decided: e.pointerType === 'mouse' };
    if (e.pointerType === 'mouse') {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setFromX(e.clientX);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.decided) {
      const dx = Math.abs(e.clientX - d.x);
      const dy = Math.abs(e.clientY - d.y);
      if (dx < 4 && dy < 4) return;
      d.decided = true;
      d.active = dx > dy;
      if (d.active) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (d.active) setFromX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d && !d.decided) setFromX(e.clientX); // a tap jumps the slider
    drag.current = null;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    let next: number | null = null;
    if (k === 'ArrowLeft' || k === 'ArrowDown') next = pos - 5;
    else if (k === 'ArrowRight' || k === 'ArrowUp') next = pos + 5;
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = 100;
    if (next === null) return;
    e.preventDefault();
    stopAnim();
    setPos(Math.min(100, Math.max(0, next)));
  };

  const pill = 'absolute top-3 rounded-full bg-black/45 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm transition-opacity duration-200 pointer-events-none';

  return (
    <div className="mx-auto w-full max-w-2xl px-2 sm:px-6">
      <div
        ref={boxRef}
        role="slider"
        tabIndex={0}
        aria-label="Before and after comparison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={`${Math.round(pos)}% after`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={onKeyDown}
        className="relative aspect-[4/5] sm:aspect-[4/3] w-full overflow-hidden rounded-[22px] bg-neutral-100 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] select-none outline-none focus-visible:ring-2 focus-visible:ring-green-600 cursor-ew-resize"
        style={{ touchAction: 'pan-y' }}
      >
        <Image src={before.src} alt={before.alt} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover pointer-events-none" draggable={false} />
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
          <Image src={after.src} alt={after.alt} fill sizes="(max-width: 768px) 100vw, 672px" className="object-cover pointer-events-none" draggable={false} />
        </div>
        <span className={`${pill} left-3`} style={{ opacity: 0.35 + 0.65 * Math.min(1, pos / 30) }}>Before</span>
        <span className={`${pill} right-3`} style={{ opacity: 0.35 + 0.65 * Math.min(1, (100 - pos) / 30) }}>After</span>
        <div className="absolute inset-y-0 pointer-events-none" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
          <div className="mx-auto h-full w-[2px] bg-white shadow-[0_0_6px_rgba(0,0,0,0.3)]" />
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-neutral-700 shadow-[0_4px_14px_rgba(0,0,0,0.25)]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M7.5 6 3.5 10l4 4M12.5 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[12px] text-neutral-400">Drag to compare</p>
    </div>
  );
}
