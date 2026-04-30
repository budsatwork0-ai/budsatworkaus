'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from 'framer-motion';
import { brand } from '../theme';
import { MARKETING_SERVICE_LIST } from '@/lib/marketing-services';

// ─── Brand tokens ──────────────────────────────────────────────────────────────
const BRAND = {
  ...brand,
  onDark: '#F8FCF9',
  mutedOnDark: 'rgba(248,252,249,0.82)',
  subtleOnDark: 'rgba(248,252,249,0.62)',
};

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
  popular: service.key === 'cleaning' || service.key === 'yard',
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
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 40, stiffness: 120 });
  const [display, setDisplay] = useState('0');
  useEffect(() => { if (inView) mv.set(target); }, [inView, mv, target]);
  useEffect(() => { return spring.on('change', v => setDisplay(Math.round(v).toString())); }, [spring]);
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
        window.dispatchEvent(new CustomEvent(entry.isIntersecting ? 'home:cta-enter' : 'home:cta-leave'));
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      window.dispatchEvent(new CustomEvent('home:cta-leave'));
    };
  }, []);

  return (
    <div className="relative" style={{ background: BRAND.bg, color: BRAND.text }}>

      {/* ════════════════════════════════════════════════ HERO — full-screen video ══ */}
      <section
        className="relative flex flex-col items-center justify-center text-center -mt-8 md:-mt-10"
        style={{
          minHeight: '100svh',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          width: '100vw',
        }}
      >
        {/* Full-bleed video — extends behind header */}
        <div
          className="absolute z-0"
          style={{ top: '-100px', left: 0, right: 0, bottom: 0 }}
        >
          {/* Mobile: static thumbnail */}
          <div
            className="md:hidden w-full h-full bg-cover bg-center"
            style={{ backgroundImage: 'url(/images/hero-thumbnail.jpg)' }}
          />
          {/* Desktop: looping video */}
          <video
            autoPlay muted loop playsInline poster="/images/hero-thumbnail.jpg"
            className="hidden md:block w-full h-full object-cover"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>

          {/* Layer 1 — uniform base: ensures text is always legible regardless of video content */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.46)' }} />
          {/* Layer 2 — directional vignette: darker at top (behind nav) and bottom edge */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.30) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.35) 100%)',
            }}
          />
          {/* Layer 3 — subtle brand-green shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.06, 0.12, 0.06] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.20) 0%, transparent 55%)' }}
          />
        </div>

        {/* Hero text */}
        <div className="relative z-10 px-5 sm:px-8 max-w-3xl mx-auto w-full">
          {/* Location chip */}
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 text-[12px] font-semibold border mb-7"
            style={{
              background: 'rgba(248,252,249,0.12)',
              borderColor: 'rgba(221,243,228,0.28)',
              color: BRAND.onDark,
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={heroIn ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.14, duration: 0.4 }}
          >
            <span style={{ color: BRAND.accentSoft }}>●</span>
            Logan &amp; South Brisbane · Locally owned
          </motion.span>

          {/* Headline */}
          <motion.h1
            className="text-[clamp(3rem,8vw,5.75rem)] font-bold leading-[1.04] tracking-[-0.02em]"
            style={{ color: BRAND.onDark }}
            initial={{ opacity: 0, y: 22 }}
            animate={heroIn ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.22, duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
          >
            Your{' '}
            {/* Rotating word — clipped vertical slide */}
            <span
              style={{
                display: 'inline-block',
                overflow: 'hidden',
                verticalAlign: 'bottom',
                lineHeight: 'inherit',
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={ROTATING_WORDS[wordIndex]}
                  style={{ display: 'inline-block', color: BRAND.onDark }}
                  initial={{ y: '100%', opacity: 0 }}
                  animate={{ y: '0%', opacity: 1 }}
                  exit={{ y: '-100%', opacity: 0 }}
                  transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  {ROTATING_WORDS[wordIndex].charAt(0).toUpperCase() + ROTATING_WORDS[wordIndex].slice(1)}
                </motion.span>
              </AnimatePresence>
            </span>
            ,<br />
            <span style={{
              color: '#7BBFA0',
              padding: '0 10px 4px',
              display: 'inline-block',
            }}>looked after.</span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            className="mt-5 text-[1.1rem] md:text-[1.2rem] max-w-lg mx-auto leading-relaxed"
            style={{ color: BRAND.mutedOnDark }}
            initial={{ opacity: 0, y: 16 }}
            animate={heroIn ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.34, duration: 0.55 }}
          >
            Cleaning, yard care, dump runs, car detailing &amp; more.
            Get a real price in minutes — not a callback next week.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-9 flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={heroIn ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/services"
                data-track="hero_quote_click"
                data-track-label="Homepage hero quote"
                className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-semibold transition-all hover:brightness-[0.92]"
                style={{ background: BRAND.accent, color: '#fff', boxShadow: '0 4px 14px rgba(15,61,46,0.20)' }}
              >
                Get a free quote {icons.arrowRight}
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/about"
                className="inline-flex items-center rounded-full px-7 py-3.5 text-[15px] font-semibold border hover:bg-white/10 transition-colors"
                style={{ borderColor: 'rgba(221,243,228,0.28)', color: BRAND.onDark }}
              >
                Meet the team
              </Link>
            </motion.div>
          </motion.div>

          {/* Trust chips */}
          <motion.div
            className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2"
            initial={{ opacity: 0 }}
            animate={heroIn ? { opacity: 1 } : {}}
            transition={{ delay: 0.60, duration: 0.5 }}
          >
            {TRUST.map(({ icon, label }, i) => (
              <motion.span
                key={label}
                className="inline-flex items-center gap-1.5 text-[13px]"
                style={{ color: BRAND.mutedOnDark }}
                initial={{ opacity: 0, y: 5 }}
                animate={heroIn ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.60 + i * 0.06 }}
              >
                <span style={{ color: BRAND.accentSoft }}>{icon}</span>
                {label}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Scroll cue */}
        <motion.div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
          style={{ color: BRAND.subtleOnDark }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <span className="text-[10px] uppercase tracking-widest font-medium">Scroll</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}>
            {icons.chevDown}
          </motion.div>
        </motion.div>
      </section>

      {/* ════════════════════════════════════════════════════════ CONTENT ══ */}
      {/* Clean white below the hero — no overlap, no floating band */}
      <div className="relative">

        {/* Very subtle background tint */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div className="absolute top-0 right-0 w-[700px] h-[500px] rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.accent}09, transparent 70%)` }} />
          <div className="absolute top-[50%] left-0 w-[500px] h-[500px] rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.primary}06, transparent 70%)` }} />
        </div>

        {/* ── Stats band — flush below hero, no overlap ── */}
        <FadeUp>
          <div className="mx-auto max-w-5xl px-5 sm:px-8 pt-14">
            <div
              className="rounded-2xl px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center"
              style={{ background: BRAND.primary, boxShadow: '0 16px 44px rgba(15,61,46,0.22)' }}
            >
              {[
                { val: 6,   suf: '',    pre: '',  lbl: 'Services quoted online' },
                { val: 2,   suf: '',    pre: '',  lbl: 'Service regions' },
                { val: 48,  suf: 'h',   pre: '<', lbl: 'Weekday quote review' },
                { val: 0,   suf: '',    pre: '',  lbl: 'Surprise fees' },
              ].map(({ val, suf, pre, lbl }) => (
                <div key={lbl} className="flex flex-col items-center py-1">
                  <span className="text-[1.6rem] font-bold tabular-nums" style={{ color: BRAND.onDark }}>
                    <AnimatedStat target={val} suffix={suf} prefix={pre} />
                  </span>
                  <span className="text-[11px] mt-0.5" style={{ color: BRAND.subtleOnDark }}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeUp>

        <div className="mx-auto max-w-5xl px-5 sm:px-8 pb-24 pt-20 space-y-24">

          {/* ── Services grid ─────────────────────────────────────────── */}
          <section>
            <FadeUp className="text-center mb-10">
              <Eyebrow>Six services · One platform</Eyebrow>
              <SectionH2 center>What we do</SectionH2>
              <p className="mt-3 text-[15px] max-w-sm mx-auto" style={{ color: BRAND.muted }}>
                Pick a service and your live quote builds instantly.
              </p>
            </FadeUp>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {SERVICES.map((s, i) => (
                <FadeUp key={s.key} delay={i * 0.055}>
                  <Link href={s.href} className="group block h-full">
                    <motion.div
                      whileHover={{ y: -5, boxShadow: '0 14px 36px rgba(15,61,46,0.11)' }}
                      whileTap={{ scale: 0.97 }}
                      className="relative h-full rounded-2xl p-5 md:p-6 border transition-shadow duration-200"
                      style={{ background: BRAND.card, borderColor: BRAND.border }}
                    >
                      {s.popular && (
                        <span
                          className="absolute top-3 right-3 text-[10px] font-semibold rounded-full px-2 py-0.5 select-none"
                          style={{ background: BRAND.accentSoft, color: BRAND.primary }}
                        >
                          Popular
                        </span>
                      )}
                      <div
                        className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
                        style={{ background: BRAND.surfaceAlt, color: BRAND.primary }}
                      >
                        {s.icon}
                      </div>
                      <p className="font-semibold text-[15px]" style={{ color: BRAND.text }}>{s.label}</p>

                      <div
                        className="mt-3 flex items-center gap-1 text-[13px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                        style={{ color: BRAND.accent }}
                      >
                        Get quote {icons.arrowRight}
                      </div>
                    </motion.div>
                  </Link>
                </FadeUp>
              ))}
            </div>
          </section>

          {/* ── How it works ──────────────────────────────────────────── */}
          <section>
            <FadeUp className="text-center mb-12">
              <Eyebrow>Three steps · Under two minutes to quote</Eyebrow>
              <SectionH2 center>Quoting that makes sense</SectionH2>
              <p className="mt-3 text-[15px] max-w-sm mx-auto" style={{ color: BRAND.muted }}>
                No callbacks, no guesswork. Build it yourself — we confirm within hours.
              </p>
            </FadeUp>

            {/* Steps — equal-height bordered grid (Craft-style) */}
            <div
              className="grid md:grid-cols-3 rounded-2xl overflow-hidden border"
              style={{ borderColor: BRAND.border }}
            >
              {STEPS.map((step, i) => (
                <FadeUp key={step.n} delay={i * 0.09}>
                  <div
                    className="p-7 md:p-8 h-full border-b md:border-b-0 md:border-r last:border-0 flex flex-col"
                    style={{ background: i === 1 ? BRAND.surfaceAlt : BRAND.card, borderColor: BRAND.border }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: BRAND.accent }}
                    >
                      Step {step.n}
                    </span>
                    <h3 className="mt-2 text-[1.05rem] font-bold" style={{ color: BRAND.text }}>{step.title}</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed flex-1" style={{ color: BRAND.muted }}>{step.body}</p>

                    {/* Tool hint — inline at bottom of each step card */}
                    <div className="mt-5 pt-4 border-t flex items-center gap-2.5" style={{ borderColor: BRAND.border }}>
                      <div
                        className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg"
                        style={{ background: BRAND.accentSoft, color: BRAND.primary }}
                      >
                        {step.tool.icon}
                      </div>
                      <p className="text-[12px] leading-snug" style={{ color: BRAND.muted }}>{step.tool.label}</p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </section>

          {/* ── About split ───────────────────────────────────────────── */}
          <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-stretch">
            {/* Left — text */}
            <FadeUp className="flex flex-col justify-center">
              <Eyebrow>Who are Buds?</Eyebrow>
              <SectionH2>Your local crew,<br />not a faceless platform.</SectionH2>
              <p className="mt-4 text-[15px] leading-relaxed" style={{ color: BRAND.muted }}>
                We&apos;re a small team based in Logan. When you book with us you&apos;re dealing with real people
                who take pride in the work — not an algorithm dispatching whoever&apos;s closest.
              </p>
              <motion.div className="mt-6" whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 300 }}>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 text-[14px] font-semibold hover:opacity-75 transition-opacity"
                  style={{ color: BRAND.primary }}
                >
                  Learn more about us {icons.arrowRight}
                </Link>
              </motion.div>
            </FadeUp>

            {/* Right — promises card, same visual weight */}
            <FadeUp delay={0.1}>
              <div
                className="rounded-2xl p-7 border h-full flex flex-col justify-center"
                style={{ background: BRAND.surface, borderColor: BRAND.border }}
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] mb-5" style={{ color: BRAND.accent }}>What we promise</p>
                <ul className="space-y-4">
                  {PROMISES.map((p, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: BRAND.accentSoft, color: BRAND.primary }}
                      >
                        {icons.check}
                      </span>
                      <span className="text-[14px] leading-snug" style={{ color: BRAND.text }}>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeUp>
          </section>

          {/* ── Early promise ──────────────────────────────────────────── */}
          <section>
            <FadeUp className="text-center mb-10">
              <Eyebrow>Starting local · Built on trust</Eyebrow>
              <SectionH2 center>What we want to be known for</SectionH2>
              <p className="mt-3 text-[15px] max-w-lg mx-auto" style={{ color: BRAND.muted }}>
                We&apos;re early, so we&apos;re keeping the promise simple: clear quotes, respectful work, and useful local support.
              </p>
            </FadeUp>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: 'Quote first', text: 'You see the scope and estimated price before we ask you to commit.' },
                { title: 'Local crew', text: 'We are building around Logan and South Brisbane, not pretending to cover everywhere.' },
                { title: 'Community-backed', text: 'Bookings, partners, and donations help us create practical local work opportunities.' },
              ].map((item, i) => (
                <FadeUp key={item.title} delay={i * 0.08}>
                  <motion.div
                    whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(15,61,46,0.09)' }}
                    className="rounded-2xl p-6 h-full border flex flex-col"
                    style={{ background: BRAND.card, borderColor: BRAND.border }}
                  >
                    <h3 className="text-[1rem] font-bold" style={{ color: BRAND.text }}>{item.title}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed flex-1" style={{ color: BRAND.muted }}>{item.text}</p>
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: BRAND.border }}>
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: BRAND.primary }}>
                        {icons.check} Built into every quote
                      </span>
                    </div>
                  </motion.div>
                </FadeUp>
              ))}
            </div>
          </section>

          {/* ── Final CTA — dark, full-width ──────────────────────────── */}
          <div ref={ctaSectionRef}>
          <FadeUp>
            <section
              className="rounded-3xl px-8 py-14 md:py-20 text-center relative overflow-hidden"
              style={{ background: BRAND.primary }}
            >
              {/* Orb decorations */}
              <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full" style={{ background: `radial-gradient(circle, ${BRAND.accent}35, transparent 70%)` }} />
              <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.06), transparent 70%)' }} />

              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-5" style={{ color: BRAND.accentSoft }}>
                  No payment until you confirm
                </p>
                <h2
                  className="text-[clamp(2.2rem,5vw,3.75rem)] font-bold tracking-tight leading-tight"
                  style={{ color: BRAND.onDark }}
                >
                  Ready to get<br />started?
                </h2>
                <p className="mt-4 text-[15px] max-w-sm mx-auto" style={{ color: BRAND.subtleOnDark }}>
                  Pick a service and build your free quote.
                  We&apos;ll lock in your price for 7 days.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/services"
                      data-track="final_quote_click"
                      data-track-label="Homepage final quote"
                      className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-[15px] font-semibold shadow-xl transition-shadow hover:shadow-2xl"
                      style={{ background: BRAND.accent, color: '#fff' }}
                    >
                      Get a free quote {icons.arrowRight}
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/get-involved"
                      data-track="donation_interest_click"
                      data-track-label="Homepage join or donate"
                      className="inline-flex rounded-full px-8 py-4 text-[15px] font-semibold border hover:bg-white/10 transition-colors"
                      style={{ borderColor: 'rgba(221,243,228,0.24)', color: BRAND.onDark }}
                    >
                      Join the crew
                    </Link>
                  </motion.div>
                </div>
              </div>
            </section>
          </FadeUp>
          </div>

        </div>
      </div>
    </div>
  );
}
