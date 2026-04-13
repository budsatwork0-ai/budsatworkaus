'use client';

import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import { brand, cx, glass, glassSoft } from '@/app/ui/theme';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function WindowIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 10v11h13V10" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M20 4c-7 0-12 5-12 12 0 2 1 4 3 4 7 0 11-7 9-16z" />
      <path d="M11 13l-6 6" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M3 16V7a2 2 0 0 1 2-2h8v11" />
      <path d="M13 10h4l3 3v3h-3" />
      <circle cx="7" cy="17.5" r="1.2" />
      <circle cx="17" cy="17.5" r="1.2" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5" />
      <path d="M5 13h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 13v4M21 13v4" />
    </svg>
  );
}

function ShoeIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M3 16c4 0 6-2 7-4l5 3c2 1 3 1 6 1v2H3z" />
      <path d="M10 12l1-2" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z" />
      <path d="M9 3v15M15 6v15" />
    </svg>
  );
}

function CarSearchIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="2" y="6" width="14" height="8" rx="2" />
      <circle cx="18" cy="14" r="4" />
      <path d="M21 17l2 2" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h2M8 14h2M8 18h2M14 10h2M14 14h2M14 18h2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg {...iconProps} className="h-4 w-4">
      <path d="M5 12h12" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5 opacity-70">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const services = [
  { key: 'windows', title: 'Window cleaning', icon: <WindowIcon />, href: '/services?service=windows' },
  { key: 'cleaning', title: 'Home cleaning', icon: <HomeIcon />, href: '/services?service=cleaning' },
  { key: 'yard', title: 'Yard & garden', icon: <LeafIcon />, href: '/services?service=yard' },
  { key: 'dump', title: 'Dump runs', icon: <TruckIcon />, href: '/services?service=dump' },
  { key: 'auto', title: 'Car detailing', icon: <CarIcon />, href: '/services?service=auto' },
  { key: 'laundry_sneakers', title: 'Laundry & Sneaker Care', icon: <ShoeIcon />, href: '/services?service=laundry_sneakers' },
];

const tools = [
  {
    title: 'Draw your yard',
    description: 'Use our map tool to outline your lawn area. We calculate the size and give you a quote range instantly.',
    icon: <MapIcon />,
  },
  {
    title: 'Rego lookup',
    description: "Pop in your number plate and we'll find your vehicle details. No guessing what size category you fall into.",
    icon: <CarSearchIcon />,
  },
  {
    title: 'Transparent pricing',
    description: 'Every add-on and multiplier is visible. You can see exactly how your quote is calculated.',
    icon: <CalculatorIcon />,
  },
];

const values = [
  'We show up when we say we will',
  'Quotes mean something — no surprise fees',
  'Local crew who actually care about the work',
  'We confirm everything before we start',
];

const testimonials = [
  {
    name: 'Sarah M.',
    suburb: 'Springwood',
    service: 'Home Cleaning',
    rating: 5,
    text: 'Absolutely brilliant service. The team were professional, on time, and left the house spotless. Will definitely be booking again.',
  },
  {
    name: 'James T.',
    suburb: 'Beenleigh',
    service: 'Yard & Garden',
    rating: 5,
    text: "Our yard was a mess after the wet season. These guys transformed it in a few hours. The quote was fair and there were no surprise charges.",
  },
  {
    name: 'Linda K.',
    suburb: 'Browns Plains',
    service: 'Window Cleaning',
    rating: 5,
    text: 'So easy to book online and get a real price upfront. The crew were friendly and thorough — windows look brand new.',
  },
];

const trustBadges = [
  'NDIS-Ready',
  'Fully Insured',
  'Vetted Crew',
  'No Surprise Fees',
];

// --- Animated Counter ---
function AnimatedStat({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 40, stiffness: 120 });
  const [display, setDisplay] = useState('0');

  useEffect(() => {
    if (inView) motionValue.set(target);
  }, [inView, motionValue, target]);

  useEffect(() => {
    const unsub = springValue.on('change', (v) => {
      setDisplay(Math.round(v).toString());
    });
    return unsub;
  }, [springValue]);

  return (
    <span ref={ref}>
      {prefix}{display}{suffix}
    </span>
  );
}

// --- Section Fade-in Wrapper ---
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as any } },
};

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      transition={{ delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function HomePage() {
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative">
      {/* HERO - Full screen with video */}
      <section
        className="relative flex items-center justify-center text-center -mt-8 md:-mt-10"
        style={{
          minHeight: '100svh',
          marginLeft: 'calc(-50vw + 50%)',
          marginRight: 'calc(-50vw + 50%)',
          width: '100vw',
        }}
      >
        {/* Video/Image Background */}
        <div
          className="absolute z-0 bg-slate-900"
          style={{ top: '-100px', left: 0, right: 0, bottom: 0 }}
        >
          <div
            className="md:hidden w-full h-full bg-cover bg-center"
            style={{ backgroundImage: 'url(/images/hero-thumbnail.jpg)' }}
          />
          <video
            autoPlay
            muted
            loop
            playsInline
            poster="/images/hero-thumbnail.jpg"
            className="hidden md:block w-full h-full object-cover"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/60" />
          {/* Subtle animated overlay shimmer */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.08, 0.14, 0.08] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, transparent 60%)' }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 md:px-8">
          <AnimatePresence>
            {heroVisible && (
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.p
                  className="text-sm font-medium text-white/90 tracking-wide"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.15, duration: 0.5 }}
                >
                  Serving Logan & South Brisbane
                </motion.p>

                <motion.h1
                  className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-white drop-shadow-lg"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                >
                  Good people doing
                  <br />
                  <span className="text-emerald-300">honest work.</span>
                </motion.h1>

                <motion.p
                  className="mt-5 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed text-white/90"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.38, duration: 0.55 }}
                >
                  We&apos;re Buds At Work — a local crew that handles cleaning, yard care, dump runs,
                  and car detailing. Get a real quote in minutes, not a callback next week.
                </motion.p>

                <motion.div
                  className="mt-8 flex flex-wrap justify-center gap-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/services"
                      className="inline-block rounded-full px-7 py-3.5 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
                      style={{ background: brand.primary, color: '#fff' }}
                    >
                      Get a free quote
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                    <Link
                      href="/about"
                      className="inline-block rounded-full px-7 py-3.5 text-base font-semibold bg-white/20 backdrop-blur text-white border border-white/30 hover:bg-white/30 transition-colors"
                    >
                      Meet the team
                    </Link>
                  </motion.div>
                </motion.div>

                {/* Trust badges */}
                <motion.div
                  className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65, duration: 0.5 }}
                >
                  {trustBadges.map((label, i) => (
                    <motion.span
                      key={label}
                      className="flex items-center gap-1.5 text-sm text-white/80"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.65 + i * 0.07 }}
                    >
                      <span className="text-emerald-300"><CheckIcon /></span>
                      {label}
                    </motion.span>
                  ))}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <span className="tracking-widest uppercase text-[10px]">Scroll</span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDownIcon />
          </motion.div>
        </motion.div>
      </section>

      {/* Live stats bar */}
      <FadeIn>
        <div
          className="mx-auto max-w-5xl px-4 sm:px-6 md:px-8 -mt-6 relative z-10"
        >
          <div
            className="rounded-2xl px-6 py-4 flex flex-wrap items-center justify-around gap-4 text-center"
            style={{
              background: brand.primary,
              boxShadow: '0 20px 40px rgba(15,61,46,0.28)',
            }}
          >
            {[
              { value: 320, suffix: '+', label: 'Jobs completed' },
              { value: 5, prefix: '', suffix: '.0★', label: 'Average rating' },
              { value: 2, suffix: ' regions', label: 'Service areas' },
              { value: 48, suffix: 'h', label: 'Quote response' },
            ].map(({ value, suffix, prefix, label }, i) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-white">
                  <AnimatedStat target={value} suffix={suffix} prefix={prefix} />
                </span>
                <span className="text-xs text-white/65 mt-0.5">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Content sections */}
      <div className="relative">
        {/* Background gradient */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.12) 0, transparent 55%), radial-gradient(1100px circle at 80% 0%, rgba(125,211,252,0.14) 0, transparent 55%), radial-gradient(900px circle at 50% 90%, rgba(191,232,209,0.18) 0, transparent 60%)',
          }}
        />

        <div className="mx-auto max-w-5xl space-y-20 pb-12 pt-16 px-4 sm:px-6 md:px-8">

          {/* SERVICES GRID */}
          <section>
            <FadeIn>
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
                  What we do
                </h2>
                <p className="mt-2 text-base" style={{ color: brand.muted }}>
                  Pick a service to start building your quote
                </p>
              </div>
            </FadeIn>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {services.map((s, i) => (
                <FadeIn key={s.key} delay={i * 0.07}>
                  <Link href={s.href} className="group min-w-0 block h-full">
                    <motion.div
                      whileHover={{ y: -4, boxShadow: '0 16px 36px rgba(15,61,46,0.14)' }}
                      whileTap={{ scale: 0.97 }}
                      className={cx(
                        'h-full rounded-2xl p-4 sm:p-5 md:p-6 text-center transition-colors cursor-pointer',
                        glass
                      )}
                    >
                      <motion.div
                        className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                        style={{ background: `${brand.primary}15`, color: brand.primary }}
                        whileHover={{ scale: 1.12, background: `${brand.primary}25` }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      >
                        {s.icon}
                      </motion.div>
                      <div className="font-semibold" style={{ color: brand.text }}>
                        {s.title}
                      </div>
                      <motion.div
                        className="mt-2 text-sm font-medium flex items-center justify-center gap-1"
                        style={{ color: brand.primary }}
                        initial={{ opacity: 0, y: 4 }}
                        whileHover={{ opacity: 1, y: 0 }}
                      >
                        Get quote <ArrowRightIcon />
                      </motion.div>
                    </motion.div>
                  </Link>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={0.3}>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-center">
                <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/services"
                    className="rounded-full px-6 py-3 text-sm font-semibold shadow hover:shadow-md transition-shadow inline-block"
                    style={{ background: brand.primary, color: '#fff' }}
                  >
                    Get a free quote
                  </Link>
                </motion.div>
              </div>
            </FadeIn>
          </section>

          {/* HOW IT WORKS */}
          <FadeIn>
            <section className={cx('rounded-3xl p-8 md:p-10', glassSoft)}>
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
                  Quoting that actually makes sense
                </h2>
                <p className="mt-2 text-base max-w-xl mx-auto" style={{ color: brand.muted }}>
                  We built tools that let you scope the job yourself — no phone tag, no vague estimates
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {tools.map((tool, i) => (
                  <motion.div
                    key={i}
                    className="text-center md:text-left"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.5 }}
                  >
                    <motion.div
                      className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                      style={{ background: `${brand.primary}15`, color: brand.primary }}
                      whileHover={{ scale: 1.1, rotate: 4 }}
                      transition={{ type: 'spring', stiffness: 300 }}
                    >
                      {tool.icon}
                    </motion.div>
                    <h3 className="font-semibold text-lg mb-2" style={{ color: brand.text }}>
                      {tool.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: brand.muted }}>
                      {tool.description}
                    </p>
                  </motion.div>
                ))}
              </div>
            </section>
          </FadeIn>

          {/* ABOUT SNIPPET */}
          <FadeIn>
            <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              <div>
                <motion.p
                  className="text-sm font-medium mb-3"
                  style={{ color: brand.primary }}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4 }}
                >
                  Who are Buds?
                </motion.p>
                <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: brand.text }}>
                  Your local crew,
                  <br />
                  not a faceless platform
                </h2>
                <p className="text-base leading-relaxed mb-6" style={{ color: brand.muted }}>
                  We&apos;re a small team based in Logan. When you book with us, you&apos;re dealing with real
                  people who take pride in the work — not an algorithm dispatching whoever&apos;s closest.
                </p>
                <motion.div whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 300 }}>
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 text-base font-semibold transition-all"
                    style={{ color: brand.primary }}
                  >
                    Learn more about us <ArrowRightIcon />
                  </Link>
                </motion.div>
              </div>

              <div className={cx('rounded-2xl p-6', glass)}>
                <h3 className="font-semibold mb-4" style={{ color: brand.text }}>
                  What we promise
                </h3>
                <ul className="space-y-3">
                  {values.map((v, i) => (
                    <motion.li
                      key={i}
                      className="flex items-start gap-3"
                      initial={{ opacity: 0, x: 12 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                    >
                      <motion.span
                        className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: `${brand.primary}20`, color: brand.primary }}
                        whileHover={{ scale: 1.2 }}
                      >
                        <CheckIcon />
                      </motion.span>
                      <span className="text-sm" style={{ color: brand.text }}>
                        {v}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </section>
          </FadeIn>

          {/* TESTIMONIALS */}
          <section>
            <FadeIn>
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
                  What our customers say
                </h2>
                <div className="flex items-center justify-center gap-1 mt-2" style={{ color: '#F59E0B' }}>
                  {[1,2,3,4,5].map((i) => <StarIcon key={i} />)}
                  <span className="ml-2 text-sm font-medium" style={{ color: brand.muted }}>5.0 average rating</span>
                </div>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-4">
              {testimonials.map((t, i) => (
                <FadeIn key={t.name} delay={i * 0.1}>
                  <motion.div
                    whileHover={{ y: -3, boxShadow: '0 14px 32px rgba(15,61,46,0.12)' }}
                    className={cx('rounded-2xl p-6 h-full', glass)}
                  >
                    <div className="flex items-center gap-0.5 mb-3" style={{ color: '#F59E0B' }}>
                      {[1,2,3,4,5].map((i) => <StarIcon key={i} />)}
                    </div>
                    <p className="text-sm leading-relaxed mb-4" style={{ color: brand.text }}>
                      &ldquo;{t.text}&rdquo;
                    </p>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: brand.text }}>{t.name}</p>
                      <p className="text-xs" style={{ color: brand.muted }}>{t.suburb} &middot; {t.service}</p>
                    </div>
                  </motion.div>
                </FadeIn>
              ))}
            </div>
            <FadeIn delay={0.2}>
              <div className="mt-6 text-center">
                <a
                  href="https://g.page/r/CYTORrk6H3xmEAI/review"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
                  style={{ color: brand.primary }}
                >
                  Had a great experience? Leave us a review
                  <ArrowRightIcon />
                </a>
              </div>
            </FadeIn>
          </section>

          {/* JOIN CTA */}
          <FadeIn>
            <motion.section
              className="rounded-3xl p-8 md:p-10 text-center relative overflow-hidden"
              style={{ background: `${brand.primary}08` }}
              whileHover={{ scale: 1.005 }}
              transition={{ type: 'spring', stiffness: 200 }}
            >
              {/* Decorative blob */}
              <div
                className="pointer-events-none absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-10"
                style={{ background: brand.primary }}
              />
              <h2 className="text-2xl md:text-3xl font-bold mb-3 relative" style={{ color: brand.text }}>
                Want to join the crew?
              </h2>
              <p className="text-base max-w-lg mx-auto mb-6 relative" style={{ color: brand.muted }}>
                We&apos;re always looking for good people — whether you want to work with us,
                partner up, or support workers looking for meaningful employment.
              </p>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="relative inline-block">
                <Link
                  href="/get-involved"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold border-2 hover:bg-white/60 transition-colors"
                  style={{ borderColor: brand.primary, color: brand.primary }}
                >
                  Get involved <ArrowRightIcon />
                </Link>
              </motion.div>
            </motion.section>
          </FadeIn>

          {/* FINAL CTA */}
          <FadeIn>
            <section className="text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: brand.text }}>
                Ready to get started?
              </h2>
              <p className="text-base mb-6" style={{ color: brand.muted }}>
                Pick a service and build your free quote. No payment until you confirm — we&apos;ll lock in your price for 7 days.
              </p>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} className="inline-block">
                <Link
                  href="/services"
                  className="inline-flex rounded-full px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
                  style={{ background: brand.primary, color: '#fff' }}
                >
                  Get a free quote
                </Link>
              </motion.div>
            </section>
          </FadeIn>
        </div>
      </div>
    </div>
  );
}
