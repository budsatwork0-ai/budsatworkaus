'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const MARKETING_PATHS = [
  '/',
  '/about',
  '/contact',
  '/faq',
  '/get-involved',
  '/pricing',
  '/privacy',
  '/terms',
  '/services',
];

const EXCLUDED_PATHS = ['/services/checkout'];

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  'iframe',
  'video',
  'audio',
  'canvas',
  'dialog',
  '[role="button"]',
  '[role="link"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[aria-modal="true"]',
  '[contenteditable="true"]',
  '[data-cursor-exclude]',
  '[data-cursor-disable]',
].join(',');

function shouldDisableCursor() {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse), (hover: none), (max-width: 1023px)').matches
  );
}

function isMarketingPath(pathname: string) {
  return (
    !EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) &&
    MARKETING_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

export function PublicCursorFollower() {
  const pathname = usePathname();
  const followerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ x: 0, y: 0 });
  const currentRef = useRef({ x: 0, y: 0 });
  const previousRef = useRef({ x: 0, y: 0 });
  const stateRef = useRef({ visible: false, card: false });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(pathname && isMarketingPath(pathname)) && !shouldDisableCursor());
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    const root = document.querySelector<HTMLElement>('[data-public-cursor-root]');
    const follower = followerRef.current;
    if (!root || !follower) return;

    const setHidden = () => {
      stateRef.current.visible = false;
      stateRef.current.card = false;
      follower.style.opacity = '0';
    };

    const setTarget = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        setHidden();
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(INTERACTIVE_SELECTOR)) {
        setHidden();
        return;
      }

      targetRef.current = { x: event.clientX, y: event.clientY };
      stateRef.current.visible = true;
      stateRef.current.card = Boolean(target.closest('[data-cursor-card]'));
    };

    const tick = () => {
      const current = currentRef.current;
      const target = targetRef.current;
      const previous = previousRef.current;
      const followerState = stateRef.current;
      const ease = followerState.card ? 0.24 : 0.18;

      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const speed = Math.min(1, Math.hypot(dx, dy) / 28);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const scale = followerState.card ? 1.34 : 0.86 + speed * 0.08;
      const opacity = followerState.visible ? (followerState.card ? 0.9 : 0.62) : 0;
      const brightness = followerState.card ? '1.18' : '1';

      follower.style.opacity = String(opacity);
      follower.style.filter = `brightness(${brightness})`;
      follower.style.transform = `translate3d(${current.x - 12}px, ${current.y - 12}px, 0) rotate(${angle + 36}deg) scale(${scale})`;

      previous.x = current.x;
      previous.y = current.y;
      rafRef.current = requestAnimationFrame(tick);
    };

    root.addEventListener('pointermove', setTarget, { passive: true });
    root.addEventListener('pointerleave', setHidden);
    root.addEventListener('pointercancel', setHidden);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      root.removeEventListener('pointermove', setTarget);
      root.removeEventListener('pointerleave', setHidden);
      root.removeEventListener('pointercancel', setHidden);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={followerRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-30 h-6 w-6 opacity-0 will-change-transform"
      style={{
        borderRadius: '72% 28% 68% 32% / 62% 34% 66% 38%',
        background:
          'radial-gradient(circle at 35% 30%, #9BCFB3 0 18%, #1E7A59 42%, #003A34 100%)',
        boxShadow:
          '0 0 0 7px rgba(155,207,179,0.12), 0 0 22px rgba(0,58,52,0.24), inset -3px -4px 8px rgba(0,58,52,0.28)',
        transform: 'translate3d(-40px, -40px, 0) rotate(36deg) scale(0.86)',
        transition: 'opacity 150ms ease, filter 150ms ease',
      }}
    >
      <span
        className="absolute left-[46%] top-[26%] h-[54%] w-px origin-top rotate-[18deg] rounded-full bg-white/35"
        aria-hidden="true"
      />
    </div>
  );
}
