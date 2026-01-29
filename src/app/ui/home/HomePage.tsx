'use client';

import Link from 'next/link';
import React from 'react';
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

const services = [
  { key: 'windows', title: 'Window cleaning', icon: <WindowIcon />, href: '/services' },
  { key: 'cleaning', title: 'Home cleaning', icon: <HomeIcon />, href: '/services' },
  { key: 'yard', title: 'Yard & garden', icon: <LeafIcon />, href: '/services' },
  { key: 'dump', title: 'Dump runs', icon: <TruckIcon />, href: '/services' },
  { key: 'auto', title: 'Car detailing', icon: <CarIcon />, href: '/services' },
  { key: 'sneakers', title: 'Sneaker care', icon: <ShoeIcon />, href: '/services' },
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

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            'radial-gradient(900px circle at 25% 10%, rgba(20,83,45,0.12) 0, transparent 55%), radial-gradient(1100px circle at 80% 0%, rgba(125,211,252,0.14) 0, transparent 55%), radial-gradient(900px circle at 50% 90%, rgba(191,232,209,0.18) 0, transparent 60%)',
        }}
      />

      <div className="mx-auto max-w-5xl space-y-20 pb-12">
        {/* HERO */}
        <section className="text-center pt-4">
          <p className="text-sm font-medium" style={{ color: brand.primary }}>
            Serving Logan & South Brisbane
          </p>

          <h1
            className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            style={{ color: brand.text }}
          >
            Good people doing
            <br />
            <span style={{ color: brand.primary }}>honest work.</span>
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: brand.muted }}
          >
            We're Buds at Work — a local crew that handles cleaning, yard care, dump runs,
            and car detailing. Get a real quote in minutes, not a callback next week.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/services"
              className="rounded-full px-7 py-3.5 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
              style={{ background: brand.primary, color: '#fff' }}
            >
              Get a quote
            </Link>
            <Link
              href="/about"
              className="rounded-full px-7 py-3.5 text-base font-semibold border-2 hover:bg-white/80 transition-colors"
              style={{ borderColor: brand.primary, color: brand.primary }}
            >
              Meet the team
            </Link>
          </div>
        </section>

        {/* SERVICES GRID */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
              What we do
            </h2>
            <p className="mt-2 text-base" style={{ color: brand.muted }}>
              Pick a service to start building your quote
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {services.map((s) => (
              <Link key={s.key} href={s.href} className="group">
                <div
                  className={cx(
                    'rounded-2xl p-5 md:p-6 text-center transition-all',
                    glass,
                    'hover:shadow-lg hover:-translate-y-0.5'
                  )}
                >
                  <div
                    className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                    style={{ background: `${brand.primary}15`, color: brand.primary }}
                  >
                    {s.icon}
                  </div>
                  <div className="font-semibold" style={{ color: brand.text }}>
                    {s.title}
                  </div>
                  <div
                    className="mt-2 text-sm font-medium flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: brand.primary }}
                  >
                    Get quote <ArrowRightIcon />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
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
              <div key={i} className="text-center md:text-left">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                  style={{ background: `${brand.primary}15`, color: brand.primary }}
                >
                  {tool.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: brand.text }}>
                  {tool.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: brand.muted }}>
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ABOUT SNIPPET */}
        <section className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: brand.primary }}>
              Who are Buds?
            </p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: brand.text }}>
              Your local crew,
              <br />
              not a faceless platform
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: brand.muted }}>
              We're a small team based in Logan. When you book with us, you're dealing with real
              people who take pride in the work — not an algorithm dispatching whoever's closest.
            </p>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 text-base font-semibold hover:gap-3 transition-all"
              style={{ color: brand.primary }}
            >
              Learn more about us <ArrowRightIcon />
            </Link>
          </div>

          <div className={cx('rounded-2xl p-6', glass)}>
            <h3 className="font-semibold mb-4" style={{ color: brand.text }}>
              What we promise
            </h3>
            <ul className="space-y-3">
              {values.map((v, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: `${brand.primary}20`, color: brand.primary }}
                  >
                    <CheckIcon />
                  </span>
                  <span className="text-sm" style={{ color: brand.text }}>
                    {v}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* JOIN CTA */}
        <section
          className="rounded-3xl p-8 md:p-10 text-center"
          style={{ background: `${brand.primary}08` }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: brand.text }}>
            Want to join the crew?
          </h2>
          <p className="text-base max-w-lg mx-auto mb-6" style={{ color: brand.muted }}>
            We're always looking for good people — whether you want to work with us,
            partner up, or support workers looking for meaningful employment.
          </p>
          <Link
            href="/get-involved"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold border-2 hover:bg-white/60 transition-colors"
            style={{ borderColor: brand.primary, color: brand.primary }}
          >
            Get involved <ArrowRightIcon />
          </Link>
        </section>

        {/* FINAL CTA */}
        <section className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: brand.text }}>
            Ready to get started?
          </h2>
          <p className="text-base mb-6" style={{ color: brand.muted }}>
            Pick a service and build your quote. We'll confirm everything before any work begins.
          </p>
          <Link
            href="/services"
            className="inline-flex rounded-full px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: brand.primary, color: '#fff' }}
          >
            Build your quote
          </Link>
        </section>
      </div>
    </div>
  );
}
