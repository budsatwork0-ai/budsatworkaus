'use client';

// Get Involved in the home page's story pattern (GET_INVOLVED_STORY).
// Visual only: every heading, sentence, link, button, form and checkout handler
// comes from GetInvolvedClient unchanged; this file only lays them out on one
// continuous canvas that glides between paper, linen and eucalyptus (#0B1A12),
// with Inter headlines, numbered labels and scroll reveals. Turning the flag off
// restores the original layout in GetInvolvedClient.

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

export default function GetInvolvedStory(p: GetInvolvedStoryProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  useStoryCanvas(rootRef, '[data-gi-hero]');

  const showImage = Boolean(p.heroImageUrl && !p.heroMissing);
  const impact = [
    { label: 'Participant Supported', value: p.stats.participants_supported ?? 0 },
    { label: 'Paid Jobs Completed', value: p.stats.paid_jobs_completed ?? 0 },
    { label: 'Equipment Purchased', value: p.stats.employment_opportunities_created ?? 0 },
  ];
  const showImpact = impact.some((s) => s.value > 0);
  let sceneIdx = 0;
  const nextN = () => ROMAN[sceneIdx++];

  const milestones = [
    {
      status: (p.stats.participants_supported ?? 0) > 0 ? 'done' : 'current',
      title: 'First participant supported',
      detail: 'Silvan is being supported through practical work routines and real job expectations.',
      value: p.stats.participants_supported,
    },
    {
      status: p.currentPaidJobs > 0 ? 'done' : 'current',
      title: 'First paid jobs completed',
      detail: 'Window cleaning and local service jobs are turning community demand into paid shifts.',
      value: p.currentPaidJobs,
    },
    {
      status: (p.stats.employment_opportunities_created ?? 0) > 0 ? 'done' : 'current',
      title: 'Equipment purchased and opportunities created',
      detail: 'Tools and supplies are being added as the work expands into more service types.',
      value: p.stats.employment_opportunities_created,
    },
    {
      status: 'next',
      title: 'Next milestone: 10 paid jobs',
      detail: 'The next target is proving repeatable work, repeatable training and repeatable customer value.',
      value: p.nextJobsTarget,
    },
  ] as const;

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

      {/* ── Opening: full-bleed photo, copy anchored bottom-left ───────────── */}
      <section
        data-gi-hero
        className="relative flex flex-col justify-end"
        style={{ minHeight: 'calc(100svh - 44px)', clipPath: 'inset(-100px 0 0 0)' }}
      >
        <div
          data-hero-media
          aria-hidden={!showImage || undefined}
          className="absolute z-0"
          style={{ top: '-100px', left: 0, right: 0, bottom: 0, transformOrigin: '50% 40%', willChange: 'transform', background: '#0B1A12' }}
        >
          {showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.heroImageUrl as string}
              alt={p.heroAlt}
              onError={p.onHeroError}
              className="h-full w-full object-cover object-[58%_center] md:object-center"
            />
          )}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to top, rgb(11 26 18) 0%, rgb(11 26 18 / 0.86) 34%, rgb(11 26 18 / 0.25) 70%, rgb(11 26 18 / 0.35) 100%), linear-gradient(90deg, rgb(11 26 18 / 0.55) 0%, rgb(11 26 18 / 0) 70%)',
          }}
        />
        <div data-hero-dim aria-hidden className="pointer-events-none absolute inset-0 z-[2]" style={{ background: 'rgb(11 26 18)', opacity: 0 }} />

        <div data-hero-copy className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-12 pt-28 md:px-16 md:pb-14" style={{ willChange: 'transform, opacity', color: '#F3F0E8' }}>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em]" style={{ color: 'rgb(243 240 232 / 0.72)' }}>
            Creating Real Paid Work Opportunities
          </p>
          <h1 className={`${HEAD} mt-4 max-w-[12ch] text-[clamp(2.6rem,11.5vw,6.25rem)] leading-[0.98]`} style={{ letterSpacing: TRACK }}>
            From First Shift To <span style={{ color: 'rgb(143 217 174)' }}>First Career</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed md:text-[18px]" style={{ color: 'rgb(243 240 232 / 0.82)' }}>
            Buds At Work helps people with disabilities build confidence, skills and income through real local jobs across Logan and South Brisbane.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#wishlist" className={`${pillBase} text-white`} style={{ background: BTN_GREEN, boxShadow: '0 10px 30px -8px rgba(28,124,84,0.55)' }}>
              Support The Next Opportunity
              {p.arrow}
            </a>
            <a href="#meet-silvan" className={`${pillBase} border border-white/40 bg-white/10 text-white backdrop-blur-sm`}>
              Meet Silvan
            </a>
          </div>

          {p.fundedPct !== null && (
            <p className="mt-5 text-[13.5px] font-medium" style={{ color: 'rgb(243 240 232 / 0.86)' }}>
              {p.fundedPct >= 100
                ? 'Wishlist fully funded — thank you!'
                : `✦  ${p.fundedPct}% of our current wishlist is funded — help us reach 100%`}
            </p>
          )}

          <dl className="mt-7 grid grid-cols-3 gap-4 border-t pt-4 md:mt-10 md:max-w-3xl" style={{ borderColor: 'rgb(243 240 232 / 0.18)' }}>
            {[
              { v: (p.stats.participants_supported ?? 0).toLocaleString(), l: 'Participant supported' },
              { v: p.currentPaidJobs.toLocaleString(), l: 'Paid jobs completed' },
              { v: String(p.remainingJobs), l: 'Jobs to next milestone' },
            ].map((s) => (
              <div key={s.l} className="flex flex-col-reverse">
                <dt className="mt-1.5 text-[10.5px] font-medium uppercase leading-snug tracking-[0.14em] md:text-[11px]" style={{ color: 'rgb(243 240 232 / 0.6)' }}>{s.l}</dt>
                <dd className="text-[clamp(1.75rem,7.5vw,2.75rem)] font-semibold tabular-nums leading-none" style={{ letterSpacing: '-0.04em' }}>{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {/* Dissolve into the canvas so no edge crosses the screen. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-10" style={{ background: 'linear-gradient(to bottom, rgb(var(--sc-bg) / 0), rgb(var(--sc-bg)))' }} />
      </section>

      {/* ── Meet Silvan ────────────────────────────────────────────────────── */}
      <section id="meet-silvan" data-tone="paper" data-scrub aria-label="Meet Silvan" className="relative scroll-mt-20 pb-[14svh] pt-[22svh] md:pt-[26svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Meet Silvan</Label>
          <h2 className={`${HEAD} mt-8 max-w-[18ch] text-[clamp(2.1rem,8.6vw,4.9rem)] leading-[1.04]`} style={{ color: INK, letterSpacing: TRACK }}>
            The work starts with one person, one shift and <span style={{ color: ACC }}>one practical win at a time.</span>
          </h2>
          <div className="mt-[9svh] grid gap-y-10 md:grid-cols-12 md:gap-x-12">
            <figure className="md:col-span-5">
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.heroImageUrl as string} alt={p.heroAlt} className="aspect-[4/5] w-full rounded-[6px] object-cover object-[70%_center]" />
              ) : (
                <div className="aspect-[4/5] w-full rounded-[6px]" style={{ background: '#0B1A12' }} />
              )}
              <figcaption className="mt-4 flex gap-3 text-[13.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                <span aria-hidden className="mt-[0.7em] h-px w-6 shrink-0" style={{ background: ACC }} />
                A real window cleaning job, a real customer, and a real paid work pathway beginning to form.
              </figcaption>
            </figure>
            <div className="md:col-span-6 md:col-start-7 md:pt-4">
              <p className="text-[19px] leading-relaxed md:text-[21px]" style={{ color: INK }}>
                Silvan is one of the first people being supported through Buds At Work. He is building confidence through hands-on routines, clear expectations and paid jobs that happen in the community.
              </p>
              <div className="mt-10 grid gap-6 border-t pt-6 sm:grid-cols-2" style={{ borderColor: HAIR }}>
                <p className="text-[15.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                  The goal is not a token activity. It is useful work with real standards: turning up, learning the task, using the tools safely and finishing a job someone values.
                </p>
                <p className="text-[15.5px] leading-relaxed" style={{ color: INK_SOFT }}>
                  Every piece of support helps create the environment around that work: equipment, training, supervision, transport and the next customer opportunity.
                </p>
              </div>
              <p className="mt-10 text-[clamp(1.4rem,5vw,2rem)] font-semibold leading-snug" style={{ color: ACC, letterSpacing: '-0.025em' }}>
                This is how a first shift can become the start of a first career.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Impact so far (only when there is something to show) ───────────── */}
      {showImpact && (
        <section data-tone="paper" data-scrub aria-label="Impact so far" className="relative py-[14svh]" style={v({ '--e': 1 })}>
          <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: REVEAL, transform: RISE }}>
            <Label n={nextN()}>Impact So Far</Label>
            <h2 className={`${HEAD} mt-8 text-[clamp(2.4rem,10vw,5.4rem)] leading-[1.03]`} style={{ color: INK, letterSpacing: TRACK }}>
              Real work. <span style={{ color: ACC }}>Real outcomes.</span>
            </h2>
            <dl className="mt-[8svh] grid gap-y-8 md:grid-cols-3 md:gap-x-12">
              {impact.filter((s) => s.value > 0).map((s) => (
                <div key={s.label} className="flex flex-col-reverse border-t pt-5" style={{ borderColor: HAIR }}>
                  <dt className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em]" style={{ color: INK_SOFT }}>{s.label}</dt>
                  <dd className="text-[clamp(4.5rem,22vw,9rem)] font-normal tabular-nums leading-[0.85]" style={{ color: INK, letterSpacing: '-0.05em' }}>
                    {s.value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* ── Progress so far: a rail that fills as you read ─────────────────── */}
      <section data-tone="paper" data-scrub aria-label="Progress so far" className="relative pb-[16svh] pt-[14svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: REVEAL }}>
          <div className="grid gap-y-6 md:grid-cols-12 md:items-end">
            <div className="md:col-span-7">
              <Label n={nextN()}>Progress So Far</Label>
              <h2 className={`${HEAD} mt-8 text-[clamp(2.3rem,9.6vw,5rem)] leading-[1.03]`} style={{ color: INK, letterSpacing: TRACK }}>
                A pathway is being built <span style={{ color: ACC }}>in public.</span>
              </h2>
            </div>
            <p className="max-w-sm text-[16px] leading-relaxed md:col-span-4 md:col-start-9" style={{ color: INK_SOFT }}>
              The numbers matter because they represent visible movement: first support, first jobs, first tools and the next milestone.
            </p>
          </div>

          <ol data-scrub className="relative mt-[10svh] pl-10 md:ml-[33.333%] md:mt-[12svh] md:pl-14" style={v({ '--line': 1 })}>
            <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px" style={{ background: HAIR }} />
            <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px origin-top" style={{ background: ACC, transform: 'scaleY(var(--line))' }} />
            {milestones.map((m, i) => (
              <li key={m.title} className={`relative ${i ? 'mt-[7svh]' : ''}`} style={{ opacity: `clamp(0.38, calc((var(--line) * ${milestones.length + 0.6} - ${i}) * 0.9), 1)` }}>
                <span
                  aria-hidden
                  className="absolute -left-10 top-0.5 inline-flex h-[27px] w-[27px] items-center justify-center rounded-full border text-[12px] font-semibold md:-left-14"
                  style={{
                    background: m.status === 'done' ? ACC : 'rgb(var(--sc-bg))',
                    borderColor: m.status === 'next' ? HAIR : ACC,
                    color: m.status === 'done' ? 'rgb(var(--sc-bg))' : ACC,
                  }}
                >
                  {m.status === 'done' ? p.check : m.status === 'current' ? '→' : '•'}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[22px] font-semibold leading-tight md:text-[26px]" style={{ color: INK, letterSpacing: '-0.025em' }}>{m.title}</h3>
                  {typeof m.value === 'number' && (
                    <span className="text-[15px] font-semibold tabular-nums" style={{ color: ACC }}>{m.value.toLocaleString()}</span>
                  )}
                </div>
                <p className="mt-2 max-w-lg text-[15.5px] leading-relaxed" style={{ color: INK_SOFT }}>{m.detail}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── The journey (social) ───────────────────────────────────────────── */}
      <section data-tone="linen" data-scrub aria-label="Watch the journey" className="relative pb-[18svh] pt-[16svh]" style={v({ '--e': 1, '--x': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: `min(${REVEAL}, ${EXIT})` }}>
          <Label n={nextN()}>Real Work. Real Progress.</Label>
          <div className="mt-8 grid gap-y-6 md:grid-cols-12 md:items-end">
            <h2 className={`${HEAD} text-[clamp(2.3rem,9.6vw,5rem)] leading-[1.03] md:col-span-8`} style={{ color: INK, letterSpacing: TRACK }}>
              Watch the journey <span style={{ color: ACC }}>as it happens.</span>
            </h2>
            <div className="md:col-span-4 md:flex md:justify-end">{p.socialLinks}</div>
          </div>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed" style={{ color: INK_SOFT }}>
            The social feed brings the work closer: jobs, training, customer moments and the everyday progress behind the pathway.
          </p>
          <div className="mt-4">{p.socialFeed}</div>
        </div>
      </section>

      {/* ── Wishlist ───────────────────────────────────────────────────────── */}
      <section id="wishlist" data-tone="dark" data-scrub aria-label="Opportunities to fund" className="relative scroll-mt-20 pb-[14svh] pt-[22svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Opportunities To Fund</Label>
          <div className="mt-8 grid gap-y-6 md:grid-cols-12 md:items-end">
            <h2 className={`${HEAD} max-w-[16ch] text-[clamp(2.3rem,9.8vw,5.4rem)] leading-[1.03] md:col-span-8`} style={{ color: INK, letterSpacing: TRACK }}>
              Fund the practical pieces that create <span style={{ color: ACC }}>more paid work.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed md:col-span-4" style={{ color: INK_SOFT }}>
              Each wishlist item is connected to a work outcome: safer jobs, better training, larger service capacity or more shifts.
            </p>
          </div>

          {p.wishlistCards === null ? (
            <div className="mt-[8svh] border-t pt-8" style={{ borderColor: HAIR }}>
              <p className="max-w-2xl text-[18px] leading-relaxed" style={{ color: INK_SOFT }}>
                The next funding needs are being prepared. You can still support the work directly or start a conversation about equipment, jobs and training.
              </p>
              <button type="button" onClick={p.onOpenSponsor} className={`${pillBase} mt-6 text-white`} style={{ background: BTN_GREEN }}>
                Start A Conversation
                {p.arrow}
              </button>
            </div>
          ) : (
            <div className="mt-[8svh] grid gap-6 md:grid-cols-2 lg:grid-cols-3">{p.wishlistCards}</div>
          )}
        </div>
      </section>

      {/* ── Why we started ─────────────────────────────────────────────────── */}
      <section data-tone="dark" data-scrub aria-label="Why we started" className="relative pb-[20svh] pt-[14svh]" style={v({ '--e': 1, '--x': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: `min(${REVEAL}, ${EXIT})` }}>
          <Label n={nextN()}>Why We Started</Label>
          <h2 className={`${HEAD} mt-10 text-[clamp(2.4rem,10.4vw,6rem)] leading-[1.02]`} style={{ color: INK, letterSpacing: TRACK }}>
            Many people want paid work.
            <span className="mt-2 block md:pl-[16%]" style={{ color: ACC }}>The opportunity is the missing piece.</span>
          </h2>
          <div className="mt-[9svh] grid gap-y-8 md:grid-cols-12 md:gap-x-12">
            <p className="max-w-sm text-[17px] leading-relaxed md:col-span-4" style={{ color: INK_SOFT }}>
              Buds At Work was created to bridge that gap through practical jobs, community support and real employment pathways.
            </p>
            <div className="space-y-6 text-[18px] leading-relaxed md:col-span-7 md:col-start-6 md:text-[20px]" style={{ color: INK }}>
              <p>Buds At Work is not a charity. It is a practical employment pathway built around useful services local customers already need.</p>
              <p style={{ color: INK_SOFT }}>
                Window cleaning, lawn mowing, property maintenance, cleaning and community work can become structured opportunities where people learn, earn and contribute.
              </p>
              <p className="border-t pt-6 font-semibold" style={{ color: ACC, borderColor: HAIR }}>The support around the job is what makes the work possible.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Other ways to help: an index, not a grid of boxes ──────────────── */}
      <section id="ways-to-help" data-tone="linen" data-scrub aria-label="Other ways to help" className="relative scroll-mt-20 pb-[12svh] pt-[22svh]" style={v({ '--e': 1 })}>
        <div className="mx-auto max-w-7xl px-6 md:px-16" style={{ opacity: ENTER, transform: RISE }}>
          <Label n={nextN()}>Other Ways To Help</Label>
          <div className="mt-8 grid gap-y-6 md:grid-cols-12 md:items-end">
            <h2 className={`${HEAD} text-[clamp(2.3rem,9.6vw,5rem)] leading-[1.03] md:col-span-8`} style={{ color: INK, letterSpacing: TRACK }}>
              Support the pathway <span style={{ color: ACC }}>from more than one angle.</span>
            </h2>
            <p className="max-w-sm text-[16px] leading-relaxed md:col-span-4" style={{ color: INK_SOFT }}>
              The strongest support is often practical: work to do, tools to use, people to learn from and shifts worth showing up for.
            </p>
          </div>
          <ul className="mt-[9svh] border-b" style={{ borderColor: HAIR }}>
            {p.otherWays.map((card, i) => {
              const cta = (
                <>
                  {card.cta}
                  <span aria-hidden style={{ color: ACC }}>{p.arrow}</span>
                </>
              );
              const ctaClass = 'inline-flex min-h-[44px] items-center gap-2 text-[15.5px] font-semibold transition-opacity hover:opacity-75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
              return (
                <li key={card.title} className="grid gap-y-3 border-t py-8 md:grid-cols-12 md:items-start md:gap-x-8 md:py-10" style={{ borderColor: HAIR }}>
                  <div className="flex items-center gap-4 md:col-span-1">
                    <span className="text-[11px] font-medium tabular-nums tracking-[0.15em]" style={{ color: ACC }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="md:hidden" style={{ color: ACC }} aria-hidden>{card.icon}</span>
                  </div>
                  <h3 className="flex items-center gap-3 text-[22px] font-semibold leading-tight md:col-span-4 md:text-[26px]" style={{ color: INK, letterSpacing: '-0.025em' }}>
                    <span className="hidden md:inline-flex" style={{ color: ACC }} aria-hidden>{card.icon}</span>
                    {card.title}
                  </h3>
                  <p className="max-w-md text-[15.5px] leading-relaxed md:col-span-4" style={{ color: INK_SOFT }}>{card.body}</p>
                  <div className="md:col-span-3 md:flex md:justify-end">
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

      {/* ── Finale ─────────────────────────────────────────────────────────── */}
      <section data-tone="paper" data-scrub aria-label="Help create the next opportunity" className="relative flex min-h-[100svh] flex-col items-center justify-center px-6 pb-[18svh] pt-[16svh] text-center" style={v({ '--e': 1 })}>
        <div className="relative z-10 flex max-w-5xl flex-col items-center" style={{ opacity: REVEAL, transform: RISE }}>
          <Label>Help Create The Next Opportunity</Label>
          <h2 className={`${HEAD} mt-8 text-[clamp(2.3rem,9.4vw,5.6rem)] leading-[1.03]`} style={{ color: INK, letterSpacing: TRACK }}>
            Every contribution helps create more <span style={{ color: ACC }}>practical paid work opportunities.</span>
          </h2>
          <p className="mt-8 max-w-md text-[17px] leading-relaxed" style={{ color: INK_SOFT }}>
            Support the equipment, training and resources that let people build confidence, skills and income through real local jobs.
          </p>
          <div className="mt-12 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <a href="#wishlist" className={`${pillBase} w-full text-white sm:w-auto`} style={{ background: BTN_GREEN, boxShadow: '0 10px 30px -8px rgba(28,124,84,0.55)' }}>
              Support A Wishlist Item
              {p.arrow}
            </a>
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
        {/* Soft hand-off into the footer's white. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[20svh]" style={{ background: 'linear-gradient(to bottom, rgb(var(--sc-bg) / 0), #fff)' }} />
      </section>

      {p.sponsorModal}
    </div>
  );
}
