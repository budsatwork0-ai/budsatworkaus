'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion';
import { publicTheme } from '@/lib/design-system/themes';
import { MARKETING_SERVICE_LIST } from '@/lib/marketing-services';
import { trackEvent } from '@/lib/track-event';

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const BRAND = publicTheme.color;

// ─── Rotating headline words ───────────────────────────────────────────────────
const ROTATING_WORDS = ['home', 'garden', 'car', 'yard', 'laundry', 'bins', 'delivery', 'shoes'];

// ─── Icons ─────────────────────────────────────────────────────────────────────
const icoBase = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
function Icon({ children, size = 20 }: { children: React.ReactNode; size?: number }) {
  return <svg {...icoBase} width={size} height={size} aria-hidden>{children}</svg>;
}

const icons = {
  windows:    <Icon><rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16M4 12h16"/></Icon>,
  cleaning:   <Icon><path d="M3 10.5L12 3l9 7.5"/><path d="M5.5 10v11h13V10"/></Icon>,
  yard:       <Icon><path d="M20 4c-7 0-12 5-12 12 0 2 1 4 3 4 7 0 11-7 9-16z"/><path d="M11 13l-6 6"/></Icon>,
  dump:       <Icon><path d="M3 16V7a2 2 0 0 1 2-2h8v11"/><path d="M13 10h4l3 3v3h-3"/><circle cx="7" cy="17.5" r="1.2"/><circle cx="17" cy="17.5" r="1.2"/></Icon>,
  auto:       <Icon><path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5"/><path d="M5 13h14"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/><path d="M3 13v4M21 13v4"/></Icon>,
  laundry:    <Icon><path d="M3 16c4 0 6-2 7-4l5 3c2 1 3 1 6 1v2H3z"/><path d="M10 12l1-2"/></Icon>,
  check:      <Icon size={14}><path d="M5 12l5 5L20 7"/></Icon>,
  arrowRight: <Icon size={16}><path d="M5 12h12"/><path d="M13 6l6 6-6 6"/></Icon>,
  chevDown:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} width={20} height={20} aria-hidden><path d="M6 9l6 6 6-6"/></svg>,
  star:       <svg viewBox="0 0 24 24" fill="currentColor" width={14} height={14} aria-hidden><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  ndis:       <Icon size={16}><circle cx="12" cy="12" r="9"/><path d="M9 12l2 2 4-4"/></Icon>,
  shield:     <Icon size={16}><path d="M12 3l7 4v5c0 4.5-3.1 8.5-7 10-3.9-1.5-7-5.5-7-10V7l7-4z"/></Icon>,
  users:      <Icon size={16}><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 6-6h.5"/><circle cx="17" cy="7" r="3"/><path d="M21 20v-2a6 6 0 0 0-6-6h-.5"/></Icon>,
  tag:        <Icon size={16}><path d="M12 2H7a2 2 0 0 0-2 2v5l8 8 7-7-8-8z"/><circle cx="7.5" cy="7.5" r="1.5" fill="currentColor"/></Icon>,
  map:        <Icon><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></Icon>,
  calc:       <Icon><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h2M8 14h2M8 18h2M14 10h2M14 14h2M14 18h2"/></Icon>,
  car:        <Icon><rect x="2" y="6" width="14" height="8" rx="2"/><circle cx="18" cy="14" r="4"/><path d="M21 17l2 2"/></Icon>,
};

// ─── Data ──────────────────────────────────────────────────────────────────────
const SERVICES = MARKETING_SERVICE_LIST.map((service) => ({
  ...service,
  icon:
    service.key === 'windows' ? icons.windows :
    service.key === 'cleaning' ? icons.cleaning :
    service.key === 'yard' ? icons.yard :
    service.key === 'dump' ? icons.dump :
    service.key === 'auto' ? icons.auto :
    icons.laundry,
  // Removed "Popular" flag — no usage data yet to justify the badge.
  popular: false,
}));

const STEPS = [
  {
    n: '01',
    title: 'Pick your service',
    body: 'Choose from 6 services. See live pricing as you configure — no hidden multipliers, no callbacks.',
    tool: { icon: icons.map,  label: 'Draw your yard on Google Maps' },
  },
  {
    n: '02',
    title: 'Build your quote',
    body: 'Map your yard, enter room counts, or look up your rego plate. Your exact price builds in real time.',
    tool: { icon: icons.car,  label: 'Rego lookup — auto-detect your vehicle' },
  },
  {
    n: '03',
    title: 'Confirm & pay',
    body: 'Leave your details. We review within 2–4 hours on weekdays then send a secure payment link.',
    tool: { icon: icons.calc, label: 'Every add-on is visible before you submit' },
  },
];

const TRUST = [
  { icon: icons.ndis,   label: 'NDIS-ready' },
  { icon: icons.shield, label: 'Fully insured' },
  { icon: icons.users,  label: 'Vetted crew' },
  { icon: icons.tag,    label: 'No surprise fees' },
  { icon: icons.calc,   label: '7-day price lock' },
];

const PROMISES = [
  'We show up when we say we will',
  'Quotes mean something — no surprise fees',
  'Local crew who actually care about the work',
  'We confirm everything before we start',
];

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedStat({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(target);
  const spring = useSpring(mv, { damping: 40, stiffness: 120 });
  const [display, setDisplay] = useState(target.toString());
  const startedRef = useRef(false);
  useEffect(() => {
    if (inView && !startedRef.current) {
      startedRef.current = true;
      mv.set(0);
      const id = requestAnimationFrame(() => mv.set(target));
      return () => cancelAnimationFrame(id);
    }
  }, [inView, mv, target]);
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v).toString())), [spring]);
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

// ─── Fade-up on scroll ────────────────────────────────────────────────────────
function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Eyebrow label ────────────────────────────────────────────────────────────
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-3" style={{ color: BRAND.accent }}>
      {children}
    </p>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionH2({ children, center = false }: { children: React.ReactNode; center?: boolean }) {
  return (
    <h2
      className={`text-[clamp(1.7rem,3.8vw,2.5rem)] font-bold tracking-tight leading-tight${center ? ' text-center' : ''}`}
      style={{ color: BRAND.text }}
    >
      {children}
    </h2>
  );
}

// ─── Homepage ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const [heroIn, setHeroIn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHeroIn(true), 60); return () => clearTimeout(t); }, []);

  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % ROTATING_WORDS.length), 2600);
    return () => clearInterval(id);
  }, []);

  // Signal to the floating CTA widget to hide when the page's own CTA is visible
  const ctaSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ctaSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        window.dispatchEvent(
          new CustomEvent('cta-section-visibility', { detail: { visible: entry.isIntersecting } })
        );
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleHeroCtaClick(label: string) {
    trackEvent({
      action: 'cta_click',
      entity_type: 'hero_cta',
      entity_id: label,
      details: { label, location: 'hero' },
      source: 'homepage',
    });
  }

  function handleServiceCardClick(serviceKey: string, serviceLabel: string) {
    trackEvent({
      action: 'service_selected',
      entity_type: 'service_card',
      entity_id: serviceKey,
      details: { label: serviceLabel, location: 'services_grid' },
      source: 'homepage',
    });
  }

  function handleBottomCtaClick(label: string) {
    trackEvent({
      action: 'cta_click',
      entity_type: 'bottom_cta',
      entity_id: label,
      details: { label, location: 'bottom_cta' },
      source: 'homepage',
    });
  }

  return (
    <main style={{ background: BRAND.bg, color: BRAND.text }}>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full opacity-[0.07] blur-3xl"
            style={{ background: BRAND.accent }}
          />
          <div
            className="absolute top-1/2 -left-20 w-[340px] h-[340px] rounded-full opacity-[0.05] blur-3xl"
            style={{ background: BRAND.primary }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 md:pt-32 md:pb-28">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={heroIn ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-3xl"
          >
            {/* Trust bar */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-8">
              {TRUST.map(({ icon, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border"
                  style={{ color: BRAND.muted, borderColor: BRAND.border ?? '#e2e8f0', background: BRAND.surface }}
                >
                  <span style={{ color: BRAND.accent }}>{icon}</span>
                  {label}
                </span>
              ))}
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(2.4rem,6vw,4rem)] font-bold tracking-tight leading-[1.1] mb-6">
              We handle your{' '}
              <span className="inline-block relative" style={{ color: BRAND.accent, minWidth: '6ch' }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={wordIndex}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="inline-block"
                  >
                    {ROTATING_WORDS[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
              <br />so you don't have to.
            </h1>

            <p className="text-lg md:text-xl mb-10 max-w-2xl" style={{ color: BRAND.muted }}>
              Book home services in minutes. Instant online quotes — no phone tag, no guesswork.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/quote"
                onClick={() => handleHeroCtaClick('get_instant_quote')}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base shadow-lg transition-all hover:opacity-90 active:scale-95"
                style={{ background: BRAND.accent, color: '#fff' }}
              >
                Get an instant quote
                <span>{icons.arrowRight}</span>
              </Link>
              <Link
                href="/services"
                onClick={() => handleHeroCtaClick('see_all_services')}
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-base border transition-all hover:opacity-80 active:scale-95"
                style={{ color: BRAND.text, borderColor: BRAND.border ?? '#e2e8f0', background: BRAND.card }}
              >
                See all services
              </Link>
            </div>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={heroIn ? { opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.35 }}
            className="mt-16 flex flex-wrap gap-x-12 gap-y-6"
          >
            {[
              { value: 6,   suffix: '+', label: 'services offered' },
              { value: 100, suffix: '%', label: 'upfront pricing' },
              { value: 4,   suffix: 'hr', label: 'quote turnaround', prefix: '<' },
            ].map(({ value, suffix, label, prefix }) => (
              <div key={label}>
                <p className="text-3xl font-bold" style={{ color: BRAND.accent }}>
                  <AnimatedStat target={value} suffix={suffix} prefix={prefix} />
                </p>
                <p className="text-sm mt-0.5" style={{ color: BRAND.muted }}>{label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SERVICES GRID ────────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: BRAND.surface }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="mb-12">
            <Eyebrow>What we do</Eyebrow>
            <SectionH2>Pick a service, get a price.</SectionH2>
            <p className="mt-3 text-base max-w-xl" style={{ color: BRAND.muted }}>
              Every service has a transparent instant quote. No sales call required.
            </p>
          </FadeUp>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SERVICES.map((svc, i) => (
              <FadeUp key={svc.key} delay={i * 0.07}>
                <Link
                  href={`/quote?service=${svc.key}`}
                  onClick={() => handleServiceCardClick(svc.key, svc.label)}
                  className="group flex flex-col h-full rounded-2xl border p-6 transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
                  style={{ background: BRAND.card, borderColor: BRAND.border ?? '#e2e8f0' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: BRAND.surface, color: BRAND.accent }}
                  >
                    {svc.icon}
                  </div>
                  <h3 className="font-semibold text-base mb-1.5" style={{ color: BRAND.text }}>
                    {svc.label}
                  </h3>
                  <p className="text-sm leading-relaxed flex-1" style={{ color: BRAND.muted }}>
                    {svc.description}
                  </p>
                  <span
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium transition-colors group-hover:opacity-80"
                    style={{ color: BRAND.accent }}
                  >
                    Get a quote {icons.arrowRight}
                  </span>
                </Link>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeUp className="mb-14 text-center">
            <Eyebrow>How it works</Eyebrow>
            <SectionH2 center>Three steps to done.</SectionH2>
          </FadeUp>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <FadeUp key={step.n} delay={i * 0.1}>
                <div className="rounded-2xl border p-7 h-full" style={{ background: BRAND.card, borderColor: BRAND.border ?? '#e2e8f0' }}>
                  <p className="text-4xl font-black mb-4 opacity-10" style={{ color: BRAND.accent }}>{step.n}</p>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: BRAND.text }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed mb-5" style={{ color: BRAND.muted }}>{step.body}</p>
                  <div
                    className="flex items-center gap-2.5 text-xs font-medium px-3 py-2 rounded-lg"
                    style={{ background: BRAND.surface, color: BRAND.muted }}
                  >
                    <span style={{ color: BRAND.accent }}>{step.tool.icon}</span>
                    {step.tool.label}
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROMISE / TRUST ──────────────────────────────────────────────── */}
      <section className="py-20" style={{ background: BRAND.surface }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <FadeUp>
              <Eyebrow>Our promise</Eyebrow>
              <SectionH2>Honest work.<br />Honest pricing.</SectionH2>
              <ul className="mt-8 space-y-4">
                {PROMISES.map(p => (
                  <li key={p} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: BRAND.accent, color: '#fff' }}
                    >
                      {icons.check}
                    </span>
                    <span className="text-sm leading-relaxed" style={{ color: BRAND.muted }}>{p}</span>
                  </li>
                ))}
              </ul>
            </FadeUp>

            <FadeUp delay={0.12}>
              <div className="rounded-2xl border p-8" style={{ background: BRAND.card, borderColor: BRAND.border ?? '#e2e8f0' }}>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} style={{ color: '#F59E0B' }}>{icons.star}</span>
                  ))}
                </div>
                <p className="text-base font-medium leading-relaxed mb-5" style={{ color: BRAND.text }}>
                  &ldquo;Finally a tradie service that gives you a real price upfront.
                  No back-and-forth, no surprises on the day.&rdquo;
                </p>
                <p className="text-sm" style={{ color: BRAND.muted }}>— Sarah M., Melbourne</p>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ───────────────────────────────────────────────────── */}
      <section className="py-24" ref={ctaSectionRef}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeUp>
            <Eyebrow>Ready?</Eyebrow>
            <SectionH2 center>Get your quote in 2 minutes.</SectionH2>
            <p className="mt-4 mb-10 text-lg" style={{ color: BRAND.muted }}>
              No account needed. Instant price. Confirm when you're ready.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/quote"
                onClick={() => handleBottomCtaClick('start_my_quote')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base shadow-lg transition-all hover:opacity-90 active:scale-95"
                style={{ background: BRAND.accent, color: '#fff' }}
              >
                Start my quote
                <span>{icons.arrowRight}</span>
              </Link>
              <Link
                href="/contact"
                onClick={() => handleBottomCtaClick('talk_to_someone')}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border transition-all hover:opacity-80 active:scale-95"
                style={{ color: BRAND.text, borderColor: BRAND.border ?? '#e2e8f0', background: BRAND.card }}
              >
                Talk to someone
              </Link>
            </div>
          </FadeUp>
        </div>
      </section>
    </main>
  );
}
