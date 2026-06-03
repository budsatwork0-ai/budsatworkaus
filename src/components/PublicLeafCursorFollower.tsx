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
const TRAIL_COUNT = 12;

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'form',
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
  '[role="dialog"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[aria-modal="true"]',
  '[contenteditable="true"]',
  '[data-cursor-exclude]',
  '[data-cursor-disable]',
  '[data-modal]',
].join(',');

type Point = {
  x: number;
  y: number;
};

type LeafTrail = Point & {
  active: boolean;
  age: number;
  life: number;
  opacity: number;
  rotation: number;
  scale: number;
  spin: number;
  driftX: number;
  driftY: number;
  blur: number;
};

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

function createTrailLeaf(): LeafTrail {
  return {
    active: false,
    age: 0,
    life: 900,
    opacity: 0,
    x: -80,
    y: -80,
    rotation: 0,
    scale: 0.6,
    spin: 0,
    driftX: 0,
    driftY: 0,
    blur: 0,
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function PublicLeafCursorFollower() {
  const pathname = usePathname();
  const mainLeafRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const previousTimeRef = useRef(0);
  const targetRef = useRef<Point>({ x: -80, y: -80 });
  const currentRef = useRef<Point>({ x: -80, y: -80 });
  const previousRef = useRef<Point>({ x: -80, y: -80 });
  const lastSpawnRef = useRef<Point>({ x: -80, y: -80 });
  const trailRef = useRef<LeafTrail[]>(Array.from({ length: TRAIL_COUNT }, createTrailLeaf));
  const trailIndexRef = useRef(0);
  const stateRef = useRef({ visible: false, card: false });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(Boolean(pathname && isMarketingPath(pathname)) && !shouldDisableCursor());
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;

    const root = document.querySelector<HTMLElement>('[data-public-cursor-root]');
    const mainLeaf = mainLeafRef.current;
    if (!root || !mainLeaf) return;

    const hide = () => {
      stateRef.current.visible = false;
      stateRef.current.card = false;
      mainLeaf.style.opacity = '0';
    };

    const setTarget = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        hide();
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (!target || target.closest(INTERACTIVE_SELECTOR)) {
        hide();
        return;
      }

      targetRef.current = { x: event.clientX, y: event.clientY };
      stateRef.current.visible = true;
      stateRef.current.card = Boolean(target.closest('[data-cursor-card]'));
    };

    const spawnTrailLeaf = (x: number, y: number, angle: number, speed: number) => {
      const index = trailIndexRef.current;
      trailIndexRef.current = (index + 1) % TRAIL_COUNT;

      trailRef.current[index] = {
        active: true,
        age: 0,
        life: randomBetween(780, 1200),
        opacity: randomBetween(0.28, 0.45),
        x: x + randomBetween(-5, 5),
        y: y + randomBetween(-5, 5),
        rotation: angle + randomBetween(-42, 42),
        scale: randomBetween(0.42, 0.82),
        spin: randomBetween(-0.05, 0.06),
        driftX: randomBetween(-0.035, 0.035) - Math.cos((angle * Math.PI) / 180) * speed * 0.004,
        driftY: randomBetween(-0.055, 0.035) - 0.025,
        blur: randomBetween(0, 1.4),
      };
    };

    const tick = (time: number) => {
      const previousTime = previousTimeRef.current || time;
      const delta = Math.min(34, time - previousTime);
      previousTimeRef.current = time;

      const current = currentRef.current;
      const target = targetRef.current;
      const previous = previousRef.current;
      const cursorState = stateRef.current;
      const ease = cursorState.card ? 0.23 : 0.17;

      current.x += (target.x - current.x) * ease;
      current.y += (target.y - current.y) * ease;

      const dx = current.x - previous.x;
      const dy = current.y - previous.y;
      const speed = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const mainScale = cursorState.card ? 1.14 : 0.96;
      const mainOpacity = cursorState.visible ? (cursorState.card ? 0.92 : 0.74) : 0;
      const brightness = cursorState.card ? '1.16' : '1';

      if (cursorState.visible && speed > 2.4) {
        const spawnDistance = Math.hypot(current.x - lastSpawnRef.current.x, current.y - lastSpawnRef.current.y);
        if (spawnDistance > 13) {
          spawnTrailLeaf(current.x, current.y, angle, speed);
          lastSpawnRef.current = { x: current.x, y: current.y };
        }
      }

      mainLeaf.style.opacity = String(mainOpacity);
      mainLeaf.style.filter = `brightness(${brightness})`;
      mainLeaf.style.transform = `translate3d(${current.x - 11}px, ${current.y - 12}px, 0) rotate(${angle + 34}deg) scale(${mainScale})`;

      trailRef.current.forEach((leaf, index) => {
        const node = trailRefs.current[index];
        if (!node || !leaf.active) {
          if (node) node.style.opacity = '0';
          return;
        }

        leaf.age += delta;
        leaf.x += leaf.driftX * delta;
        leaf.y += leaf.driftY * delta + Math.sin((leaf.age + index * 80) / 180) * 0.12;
        leaf.rotation += leaf.spin * delta;

        const progress = Math.min(1, leaf.age / leaf.life);
        const fade = Math.max(0, 1 - progress);
        const opacity = cursorState.visible ? leaf.opacity * fade : leaf.opacity * fade * 0.45;
        const scale = leaf.scale * (0.86 + progress * 0.16);
        const blur = leaf.blur + progress * 0.9;

        node.style.opacity = String(opacity);
        node.style.filter = `blur(${blur.toFixed(2)}px)`;
        node.style.transform = `translate3d(${leaf.x - 8}px, ${leaf.y - 8}px, 0) rotate(${leaf.rotation}deg) scale(${scale})`;

        if (progress >= 1) {
          leaf.active = false;
          node.style.opacity = '0';
        }
      });

      previous.x = current.x;
      previous.y = current.y;
      rafRef.current = requestAnimationFrame(tick);
    };

    root.addEventListener('pointermove', setTarget, { passive: true });
    root.addEventListener('pointerleave', hide);
    root.addEventListener('pointercancel', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('mouseleave', hide);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      root.removeEventListener('pointermove', setTarget);
      root.removeEventListener('pointerleave', hide);
      root.removeEventListener('pointercancel', hide);
      window.removeEventListener('blur', hide);
      document.removeEventListener('mouseleave', hide);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 overflow-visible">
      {Array.from({ length: TRAIL_COUNT }, (_, index) => (
        <div
          key={index}
          ref={(node) => {
            trailRefs.current[index] = node;
          }}
          className="pointer-events-none fixed left-0 top-0 h-4 w-4 opacity-0 will-change-transform"
          style={{
            transform: 'translate3d(-80px, -80px, 0)',
          }}
        >
          <LeafSvg gradientId={`leaf-trail-${index}`} />
        </div>
      ))}

      <div
        ref={mainLeafRef}
        className="pointer-events-none fixed left-0 top-0 h-6 w-6 opacity-0 will-change-transform"
        style={{
          filter: 'brightness(1)',
          transform: 'translate3d(-80px, -80px, 0) rotate(34deg)',
          transition: 'opacity 150ms ease, filter 160ms ease',
        }}
      >
        <LeafSvg main gradientId="leaf-main" />
      </div>
    </div>
  );
}

function LeafSvg({ gradientId, main = false }: { gradientId: string; main?: boolean }) {
  const opacity = main ? 0.96 : 0.78;

  return (
    <svg viewBox="0 0 32 32" className="h-full w-full overflow-visible" fill="none" aria-hidden="true">
      <path
        d="M4.4 18.9C7.8 8.8 17.4 4.5 28.1 4.1C27 14.8 20.8 24.3 9.2 24.4C6.7 24.4 4.9 22.1 4.4 18.9Z"
        fill={`url(#${gradientId})`}
        opacity={opacity}
      />
      <path
        d="M6.2 22.7C11.5 18 17.6 13.4 25.8 6.1"
        stroke="rgba(255,255,255,0.48)"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M12.4 17.1C10.9 15.4 9.9 13.8 9.5 12.4M16.3 14C15.4 12 15.1 10.4 15.1 8.9M16 14.3C18 14.1 20 14.5 21.6 15.5M11.6 17.9C13.3 18.2 15 18.9 16.2 20"
        stroke="rgba(0,58,52,0.22)"
        strokeWidth="0.7"
        strokeLinecap="round"
      />
      <path
        d="M5.7 23.9C4.4 25.1 3.2 26.2 2.3 27.3"
        stroke="#003A34"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.58"
      />
      <defs>
        <radialGradient id={gradientId} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(13 10) rotate(46) scale(20 15)">
          <stop stopColor="#B8E2A2" />
          <stop offset="0.46" stopColor="#5FAE37" />
          <stop offset="1" stopColor="#003A34" />
        </radialGradient>
      </defs>
    </svg>
  );
}
