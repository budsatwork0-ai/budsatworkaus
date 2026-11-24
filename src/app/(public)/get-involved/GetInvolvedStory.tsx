'use client';

// Get Involved in the home page's story pattern (GET_INVOLVED_STORY).
// v2 (24 Nov 2026, Jackson: "too many words and not enough direction"): fewer
// words and a clear path. What this is -> three ways to help -> who it helps ->
// proof -> wishlist (main action) -> other ways -> final action. Copy here is
// trimmed from the original page; the full original copy and layout still live
// in GetInvolvedClient and render whenever the flag is off. All forms, checkout
// handlers, social links and anchors are passed in unchanged.

import React, { useRef } from 'react';
import Link from 'next/link';
import { useStoryCanvas } from '@/app/ui/story/useStoryCanvas';

const SANS = 'var(--font-inter), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const INK = 'rgb(var(--sc-ink))';
const INK_SOFT = 'rgb(var(--sc-ink) / 0.66)';
const ACC = 'rgb(var(--sc-acc))';
const HAIR = 'rgb(var(--sc-ink) / 0.14)';
const BTN_GREEN = '#1C7C54';
const v = (o: Record<string, string | number>) => o as React.CSSProperties;
// Text dissolves in/out around tone changes (same curves as the home page).
const ENTER = 'clamp(0, calc((var(--e) - 0.62) * 2.8), 1)';
const EXIT = 'var(--x)';
// Gentler reveal for scenes that sit on the same tone as the one before.
const REVEAL = 'clamp(0, calc((var(--e) - 0.22) * 2.4), 1)';
const RISE = 'translate3d(0, calc((1 - var(--e)) * 36px), 0)';
const HEAD = 'font-semibold';
const TRACK = '-0.035em';
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export interface StoryWay {
  title: string;
  body: string;
  cta: string;
  href?: string;
  icon: React.ReactNode;
}

export interface GetInvolvedStoryProps {
  heroImageUrl: string | null;
  heroMissing: boolean;
  onHeroError: () => void;
  heroAlt: string;
  fundedPct: number | null;
  stats: {
    participants_supported?: number | null;
    paid_jobs_completed?: number | null;
    employment_opportunities_created?: number | null;
  };
  currentPaidJobs: number;
  remainingJobs: number;
  nextJobsTarget: number;
  socialLinks: React.ReactNode;
  socialFeed: React.ReactNode;
  wishlistCards: React.ReactNode | null;
  otherWays: StoryWay[];
  arrow: React.ReactNode;
  check: React.ReactNode;
  donating: boolean;
  onDonate: (amountCents: number) => void;
  onOpenSponsor: () => void;
  sponsorModal: React.ReactNode;
}

function Label({ n, children, className = '' }: { n?: string; children: React.ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.2em] ${className}`} style={{ color: INK_SOFT }}>
      {n && <span style={{ color: ACC }}>{n}</span>}
      {n && <span aria-hidden className="h-px w-8" style={{ background: HAIR }} />}
      {children}
    </p>
  );
}

const pillBase =
  'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-7 py-3 text-[15px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60';

// Short lines for the "Other ways" index (trimmed from the original card copy,
// which still renders in full with the flag off).
const WAY_SHORT: Record<string, string> = {
  'Hire Buds At Work': 'Your local job becomes a paid shift.',
  'Donate Equipment': 'Tools, safety gear, supplies or transport.',
  'Become A Training Partner': 'Share practical skills on the job.',
  'Offer Workplace Experience': 'A supported place to learn routines.',
  'Sponsor A Shift': 'Fund the support around a shift.',
};

const PRIMARY_LABEL = 'Support A Wishlist Item';

function NextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="inline-flex min-h-[44px] items-center gap-2 text-[15.5px] font-semibold transition-opacity hover:opacity-75" style={{ color: INK }}>
      {children}
      <span aria-hidden style={{ color: ACC }}>↓</span>
    </a>
  );
}

export default function GetInvolvedStory(p: GetInvolvedStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useStoryCanvas(rootRef, '[data-gi-hero]');

  const showImage = Boolean(p.heroImageUrl && !p.heroMissing);
  const equipment = p.stats.employment_opportunities_created ?? 0;
  const proof = [
    { label: 'Participant supported', value: (p.stats.participants_supported ?? 0).toLocaleString() },
    { label: 'Paid jobs completed', value: p.currentPaidJobs.toLocaleString() },
    ...(equipment > 0 ? [{ label: 'Equipment purchased', value: equipment.toLocaleString() }] : []),
    { label: 'Jobs to next milestone', value: String(p.remainingJobs) },
  ];
  let sceneIdx = 0;
  const nextN = () => ROMAN[sceneIdx++];

  const primary = (extra = '') => (
    <a href="#wishlist" className={`${pillBase} text-white ${extra}`} style={{ background: BTN_GREEN, boxShadow: '0 10px 30px -8px rgba(28,124,84,0.55)' }}>
      {PRIMARY_LABEL}
      {p.arrow}
    </a>
  );

  const ways = [
    { n: '01', title: 'Fund a wishlist item', line: 'Equipment that creates more shifts.', href: '#wishlist' },
    { n: '02', title: 'Book a job', line: 'Your local job becomes a paid shift.', href: '/services' },
    { n: '03', title: 'Give tools, skills or time', line: 'Equipment, training or work experience.', href: '#ways-to-help' },
  ];

  return (
    <div
      ref={rootRef}
      data-story-canvas
      data-story-gi
      className="relative -mb-20 -mt-8 md:-mb-10 md:-mt-10"
      style={v({
        marginLeft: 'calc(-50vw + 50%)',
        marginRight: 'calc(-50vw + 50%)',
        width: '100vw',
        '--sc-bg': '11 26 18',
        '--sc-ink': '243 240 232',
        '--sc-acc': '143 217 174',
        background: 'rgb(var(--sc-bg))',
        color: INK,
        fontFamily: SANS,
      })}
    >
      {/* Sticky header needs a non-scrolling overflow clip on the page shell. */}
      <style>{'html:has([data-story-gi]),body:has([data-story-gi]),div:has(> main [data-story-gi]){overflow-x:clip}'}</style>

      {/* ── What this is ───────────────────────────────────────────────────── */}
      <section data-gi-hero className="relative flex flex-col justify-end" style={{ minHeight: 'calc(100svh - 44px)', clipPath: 'inset(-100px 0 0 0)' }}>
        <div
          data-hero-media
          aria-hidden={!showImage || undefined}
          className="absolute z-0"
          style={{ top: '-100px', left: 0, right: 0, bottom: 0, transformOrigin: '50% 40%', willChange: 'transform', background: '#0B1A12' }}
        >
          {showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.heroImageUrl as string} alt={p.heroAlt} onError={p.onHeroError} className="h-full w-full object-cover object-[58%_center] md:object-center" />
          )}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to top, rgb(11 26 18) 0%, rgb(11 26 18 / 0.82) 30%, rgb(11 26 18 / 0.2) 66%, rgb(11 26 18 / 0.35) 100%), linear-gradient(90deg, rgb(11 26 18 / 0.5) 0%, rgb(11 26 18 / 0) 70%)',
          }}
        />
        <div data-hero-dim aria-hidden className="pointer-events-none absolute inset-0 z-[2]" style={{ background: 'rgb(11 26 18)', opacity: 0 }} />

        <div data-hero-copy className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-14 pt-28 md:px-16 md:pb-20" style={{ willChange: 'transform, opacity', color: '#F3F0E8' }}>
          <h1 className={`${HEAD} max-w-[12ch] text-[clamp(2.8rem,12.5vw,6.5rem)] leading-[0.98]`} style={{ letterSpacing: TRACK }}>
            From First Shift To <span style={{ color: 'rgb(143 217 174)' }}>First Career</span>
          </h1>
          <p className="mt-5 max-w-md text-[17px] leading-relaxed md:text-[19px]" style={{ color: 'rgb(243 240 232 / 0.84)' }}>
            Real paid local jobs for people with disabilities across Logan and South Brisbane.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            {primary()}
            <a href="#three-ways" className="inline-flex min-h-[44px] items-center gap-2 text-[15.5px] font-semibold text-white transition-opacity hover:opacity-75">
              Three ways to help <span aria-hidden style={{ color: 'rgb(143 217 174)' }}>↓</span>
            </a>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-10" style={{ background: 'linear-gradient(to bottom, rgb(var(--sc-bg) / 0), rgb(var(--sc-bg)))' }} />
      </section>

      {/* ── Three ways to help: an early chooser ───────────────────────────── */}
      <section id="three-ways" data-tone="paper" data-scrub aria-label="Three ways to help" className="relative scroll-mt-20 pb-[12svh] pt-[20svh] md:pt-[24svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Get involved</Label>
          <h2 className={`${HEAD} mt-8 text-[clamp(2.5rem,11vw,5.6rem)] leading-[1.02]`} style={{ color: INK, letterSpacing: TRACK }}>
            Three ways <span style={{ color: ACC }}>to help.</span>
          </h2>
          <ul className="mt-[7svh] grid border-b md:grid-cols-3 md:border-b-0" style={{ borderColor: HAIR }}>
            {ways.map((w) => {
              const inner = (
                <>
                  <span className="text-[11px] font-medium tabular-nums tracking-[0.15em]" style={{ color: ACC }}>{w.n}</span>
                  <span className="mt-3 flex items-center justify-between gap-4 text-[24px] font-semibold leading-tight md:text-[28px]" style={{ color: INK, letterSpacing: '-0.025em' }}>
                    {w.title}
                    <span aria-hidden className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: ACC }}>{w.href.startsWith('#') ? '↓' : '→'}</span>
                  </span>
                  <span className="mt-2 block text-[15.5px] leading-relaxed" style={{ color: INK_SOFT }}>{w.line}</span>
                </>
              );
              const cls = 'group block border-t py-7 md:border-t md:py-8 md:pr-10';
              return (
                <li key={w.n}>
                  {w.href.startsWith('/') ? (
                    <Link href={w.href} className={cls} style={{ borderColor: HAIR }}>{inner}</Link>
                  ) : (
                    <a href={w.href} className={cls} style={{ borderColor: HAIR }}>{inner}</a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Who it helps ───────────────────────────────────────────────────── */}
      <section id="meet-silvan" data-tone="paper" data-scrub aria-label="Who it helps" className="relative scroll-mt-20 py-[12svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto grid max-w-7xl gap-y-10 px-6 md:grid-cols-12 md:items-end md:gap-x-12 md:px-16" style={{ opacity: REVEAL, transform: RISE }}>
          <div className="md:col-span-7">
            <Label n={nextN()}>Who it helps</Label>
            <h2 className={`${HEAD} mt-8 text-[clamp(2.2rem,9.4vw,4.9rem)] leading-[1.04]`} style={{ color: INK, letterSpacing: TRACK }}>
              Many people want paid work. <span style={{ color: ACC }}>The opportunity is the missing piece.</span>
            </h2>
            <p className="mt-6 max-w-md text-[17px] leading-relaxed" style={{ color: INK_SOFT }}>
              Founded by Jackson. Started with Silvan. Making room for more people like him, one paid shift at a time.
            </p>
            <div className="mt-7"><NextLink href="#progress">See the progress</NextLink></div>
          </div>
          <figure className="md:col-span-5">
            {showImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.heroImageUrl as string} alt={p.heroAlt} className="aspect-[4/5] w-full rounded-[6px] object-cover object-[70%_center] md:aspect-[5/6]" />
            ) : (
              <div className="aspect-[4/5] w-full rounded-[6px]" style={{ background: '#0B1A12' }} />
            )}
            <figcaption className="mt-3 text-[13px]" style={{ color: INK_SOFT }}>A real window cleaning job.</figcaption>
          </figure>
        </div>
      </section>

      {/* ── Proof ──────────────────────────────────────────────────────────── */}
      <section id="progress" data-tone="linen" data-scrub aria-label="Progress so far" className="relative scroll-mt-20 pb-[16svh] pt-[14svh]" style={v({ '--e': 1, '--x': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: `min(${REVEAL}, ${EXIT})` }}>
          <Label n={nextN()}>Progress so far</Label>
          <h2 className={`${HEAD} mt-8 text-[clamp(2.4rem,10vw,5.4rem)] leading-[1.03]`} style={{ color: INK, letterSpacing: TRACK }}>
            Real work. <span style={{ color: ACC }}>Real progress.</span>
          </h2>
          <dl className={`mt-[7svh] grid gap-x-5 gap-y-8 ${proof.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3'}`}>
            {proof.map((s) => (
              <div key={s.label} className="flex flex-col-reverse border-t pt-4" style={{ borderColor: HAIR }}>
                <dt className="mt-2 text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: INK_SOFT }}>{s.label}</dt>
                <dd className="text-[clamp(2.9rem,14vw,7rem)] font-normal tabular-nums leading-[0.9]" style={{ color: INK, letterSpacing: '-0.05em' }}>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 text-[17px] font-medium" style={{ color: INK }}>
            Next milestone: <span style={{ color: ACC }}>{p.nextJobsTarget} paid jobs</span>.
          </p>
          <div className="mt-[8svh] grid gap-y-5 md:grid-cols-12 md:items-center">
            <p className="text-[15.5px] md:col-span-6" style={{ color: INK_SOFT }}>Watch the journey as it happens.</p>
            <div className="md:col-span-6 md:flex md:justify-end">{p.socialLinks}</div>
          </div>
          <div className="mt-2">{p.socialFeed}</div>
          <div className="mt-[7svh]">{primary()}</div>
        </div>
      </section>

      {/* ── Wishlist: the main action ──────────────────────────────────────── */}
      <section id="wishlist" data-tone="dark" data-scrub aria-label="Wishlist" className="relative scroll-mt-20 pb-[12svh] pt-[20svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Wishlist</Label>
          <div className="mt-8 grid gap-y-5 md:grid-cols-12 md:items-end">
            <h2 className={`${HEAD} max-w-[14ch] text-[clamp(2.4rem,10vw,5.4rem)] leading-[1.03] md:col-span-8`} style={{ color: INK, letterSpacing: TRACK }}>
              Fund the tools that create <span style={{ color: ACC }}>paid work.</span>
            </h2>
            <div className="md:col-span-4">
              <p className="text-[16px] leading-relaxed" style={{ color: INK_SOFT }}>Pick an item. Each one is tied to a work outcome.</p>
              {p.fundedPct !== null && (
                <p className="mt-3 text-[14px] font-medium" style={{ color: ACC }}>
                  {p.fundedPct >= 100 ? 'Wishlist fully funded — thank you!' : `✦  ${p.fundedPct}% funded — help us reach 100%`}
                </p>
              )}
            </div>
          </div>

          {p.wishlistCards === null ? (
            <div className="mt-[7svh] border-t pt-8" style={{ borderColor: HAIR }}>
              <p className="max-w-xl text-[17px] leading-relaxed" style={{ color: INK_SOFT }}>New items are being prepared. You can still support the work directly.</p>
              <button type="button" onClick={p.onOpenSponsor} className={`${pillBase} mt-6 text-white`} style={{ background: BTN_GREEN }}>
                Start A Conversation
                {p.arrow}
              </button>
            </div>
          ) : (
            <div className="mt-[7svh] grid gap-6 md:grid-cols-2 lg:grid-cols-3">{p.wishlistCards}</div>
          )}
          <div className="mt-10"><NextLink href="#ways-to-help">Other ways to help</NextLink></div>
        </div>
      </section>

      {/* ── Other ways to help ─────────────────────────────────────────────── */}
      <section id="ways-to-help" data-tone="linen" data-scrub aria-label="Other ways to help" className="relative scroll-mt-20 pb-[10svh] pt-[20svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Other ways</Label>
          <h2 className={`${HEAD} mt-8 text-[clamp(2.4rem,10vw,5.4rem)] leading-[1.03]`} style={{ color: INK, letterSpacing: TRACK }}>
            More ways <span style={{ color: ACC }}>to help.</span>
          </h2>
          <ul className="mt-[7svh] border-b" style={{ borderColor: HAIR }}>
            {p.otherWays.map((card, i) => {
              const cta = (
                <>
                  {card.cta}
                  <span aria-hidden style={{ color: ACC }}>{p.arrow}</span>
                </>
              );
              const ctaClass = 'inline-flex min-h-[44px] shrink-0 items-center gap-2 text-[15px] font-semibold transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
              return (
                <li key={card.title} className="grid gap-y-1 border-t py-6 md:grid-cols-12 md:items-center md:gap-x-8" style={{ borderColor: HAIR }}>
                  <div className="flex items-center gap-4 md:col-span-5">
                    <span className="w-5 text-[11px] font-medium tabular-nums tracking-[0.15em]" style={{ color: ACC }}>{String(i + 1).padStart(2, '0')}</span>
                    <span style={{ color: ACC }} aria-hidden>{card.icon}</span>
                    <h3 className="text-[20px] font-semibold leading-tight md:text-[24px]" style={{ color: INK, letterSpacing: '-0.02em' }}>{card.title}</h3>
                  </div>
                  <p className="pl-9 text-[15px] md:col-span-4 md:pl-0" style={{ color: INK_SOFT }}>{WAY_SHORT[card.title] ?? card.body}</p>
                  <div className="pl-9 md:col-span-3 md:flex md:justify-end md:pl-0">
                    {card.href ? (
                      <Link href={card.href} className={ctaClass} style={{ color: INK }}>{cta}</Link>
                    ) : (
                      <button type="button" onClick={p.onOpenSponsor} className={ctaClass} style={{ color: INK }}>{cta}</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* ── Final action ───────────────────────────────────────────────────── */}
      <section data-tone="paper" data-scrub aria-label="Help create the next opportunity" className="relative flex min-h-[86svh] flex-col items-center justify-center px-6 pb-[18svh] pt-[14svh] text-center" style={v({ '--e': 1 })}>
        <div className="relative z-10 flex max-w-4xl flex-col items-center" style={{ opacity: REVEAL, transform: RISE }}>
          <h2 className={`${HEAD} text-[clamp(2.6rem,11vw,6.2rem)] leading-[1.02]`} style={{ color: INK, letterSpacing: TRACK }}>
            Help create the <span style={{ color: ACC }}>next opportunity.</span>
          </h2>
          <div className="mt-10 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {primary('w-full sm:w-auto')}
            <Link href="/services" className={`${pillBase} w-full border sm:w-auto`} style={{ borderColor: 'rgb(var(--sc-ink) / 0.25)', color: INK }}>
              Book A Job
              {p.arrow}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => p.onDonate(5000)}
            disabled={p.donating}
            className="mt-5 min-h-[44px] text-[13px] font-semibold uppercase tracking-[0.18em] underline decoration-1 underline-offset-[6px] transition-opacity hover:opacity-75 disabled:opacity-60"
            style={{ color: INK_SOFT, textDecorationColor: HAIR }}
          >
            Support $50
          </button>
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[20svh]" style={{ background: 'linear-gradient(to bottom, rgb(var(--sc-bg) / 0), #fff)' }} />
      </section>

      {p.sponsorModal}
    </div>
  );
}
