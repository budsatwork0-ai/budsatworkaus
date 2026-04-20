'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { brand } from '@/app/ui/theme';
import FeedbackModal from '@/app/(public)/get-involved/FeedbackModal';

// Removed CTA_GREEN — using brand.primary for a more refined look

// ─── Analytics helper ──────────────────────────────────────────────────────────
function fireEvent(name: string, params?: Record<string, string>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).gtag?.('event', name, params);
  } catch { /* no-op */ }
}

// ─── Icons ─────────────────────────────────────────────────────────────────────
function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function ChatIcon({ size = 13 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden>
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────────
export function FeedbackWidget() {
  const pathname = usePathname();
  // Don't show the quote CTA when already on the services/quote builder page
  const onServices = pathname?.startsWith('/services');
  // On the homepage the hero fills the viewport — suppress the floating CTA until
  // the user has scrolled past it so we don't stack three identical green buttons.
  const isHome = pathname === '/';

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [ctaHidden, setCtaHidden] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const ctaRef = useRef<HTMLAnchorElement>(null);

  // On the homepage: track scroll so the CTA only appears after passing the hero
  useEffect(() => {
    if (!isHome) return;
    const check = () => setPastHero(window.scrollY > window.innerHeight * 0.65);
    check();
    window.addEventListener('scroll', check, { passive: true });
    return () => window.removeEventListener('scroll', check);
  }, [isHome]);

  // Detect reduced-motion preference + drive slide-in timing
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const rm = mq.matches;
    setReducedMotion(rm);

    // On non-home pages slide in after a short delay; on homepage the pastHero
    // state controls reveal instead, so we just mark ready immediately.
    const t1 = setTimeout(() => setVisible(true), rm || isHome ? 0 : 350);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);

    return () => {
      clearTimeout(t1);
      mq.removeEventListener('change', handler);
    };
  }, [isHome]);

  // On the homepage, hide when the page's own "Ready to get started" CTA is visible
  useEffect(() => {
    if (!isHome) {
      setCtaHidden(false);
      return;
    }
    const onEnter = () => setCtaHidden(true);
    const onLeave = () => setCtaHidden(false);
    window.addEventListener('home:cta-enter', onEnter);
    window.addEventListener('home:cta-leave', onLeave);
    return () => {
      window.removeEventListener('home:cta-enter', onEnter);
      window.removeEventListener('home:cta-leave', onLeave);
    };
  }, [isHome]);

  // Hide mobile bar when the global footer is visible
  useEffect(() => {
    if (!isHome) return;
    const footer = document.querySelector('footer');
    if (!footer) return;
    const obs = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0.01 }
    );
    obs.observe(footer);
    return () => obs.disconnect();
  }, [isHome]);

  // Fire cta_view once when the desktop CTA enters the viewport
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fireEvent('cta_view', { cta: 'floating_quote_cta' });
          obs.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const handleCTAClick = () => fireEvent('cta_click', { cta: 'floating_quote_cta' });

  // The CTA is "ready to show" when:
  //   - on the homepage: the user has scrolled past the hero
  //   - on all other pages: always (controlled by slide-in delay above)
  const ctaReady = isHome ? pastHero : visible;

  // Desktop: slide in from right, slide back out when page CTA is visible
  const shouldShow = ctaReady && !ctaHidden;
  const desktopTransform = [
    'translateY(-50%)',
    shouldShow ? 'translateX(0)' : 'translateX(calc(100% + 20px))',
  ].join(' ');

  const desktopTransition = reducedMotion
    ? 'none'
    : 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease';

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────────────
          1. Primary floating CTA — desktop (fixed right, vertically centred)
         ───────────────────────────────────────────────────────────────────── */}
      {isHome && (
        <div
          className="hidden md:block fixed right-4 z-40"
          style={{
            top: '50%',
            transform: desktopTransform,
            opacity: shouldShow ? 1 : 0,
            transition: desktopTransition,
          }}
        >
          <Link
            ref={ctaRef}
            href="/services"
            aria-label="Get a free quote"
            data-tracking-name="floating_quote_cta"
            onClick={handleCTAClick}
            className="inline-flex items-center justify-center gap-1.5 font-semibold text-white hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 transition-opacity"
            style={{
              background: brand.accent,
              height: '42px',
              padding: '0 16px',
              fontSize: '13px',
              borderRadius: '999px',
              letterSpacing: '0.01em',
              outlineColor: brand.accent,
            }}
          >
            <ArrowRightIcon />
            Get a free quote
          </Link>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          2. Primary floating CTA — mobile full-width bottom sticky bar
         ───────────────────────────────────────────────────────────────────── */}
      {isHome && shouldShow && !footerVisible && (
        <div
          className="md:hidden fixed bottom-0 inset-x-0 z-40"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Link
            href="/services"
            aria-label="Get a free quote"
            data-tracking-name="floating_quote_cta"
            onClick={handleCTAClick}
            className="flex items-center justify-center gap-2 w-full font-semibold text-white hover:opacity-90 active:opacity-80"
            style={{
              background: brand.accent,
              height: '52px',
              fontSize: '15px',
            }}
          >
            <ArrowRightIcon />
            Get a free quote
          </Link>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────
          3. Demoted feedback tab — desktop only, bottom-right corner
          Hidden on /services — the quote assistant occupies that space.
         ───────────────────────────────────────────────────────────────────── */}
      <div className="hidden md:block fixed bottom-6 right-4 z-40">
        <button
          onClick={() => setFeedbackOpen(true)}
          aria-label="Report an issue"
          data-tracking-name="feedback_entry"
          className="flex items-center gap-1 text-[11px] transition-opacity hover:opacity-100"
          style={{ color: 'rgba(0,0,0,0.28)', opacity: 0.7 }}
        >
          <ChatIcon size={11} />
          Report issue
        </button>
      </div>

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </>
  );
}
