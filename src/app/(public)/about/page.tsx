'use client';

import Link from 'next/link';
import { brand, cx, glass, glassSoft } from '../../ui/theme';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function HeartIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg {...iconProps} className="h-6 w-6">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
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

function HomeIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5.5 10v11h13V10" />
    </svg>
  );
}

function WindowIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M20 4c-7 0-12 5-12 12 0 2 1 4 3 4 7 0 11-7 9-16z" />
      <path d="M11 13l-6 6" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 16V7a2 2 0 0 1 2-2h8v11" />
      <path d="M13 10h4l3 3v3h-3" />
      <circle cx="7" cy="17.5" r="1.2" />
      <circle cx="17" cy="17.5" r="1.2" />
    </svg>
  );
}

function CarIcon() {
  return (
    <svg {...iconProps} className="h-5 w-5">
      <path d="M3 13l2-5a3 3 0 0 1 2.8-2h8.4A3 3 0 0 1 19 8l2 5" />
      <path d="M5 13h14" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
      <path d="M3 13v4M21 13v4" />
    </svg>
  );
}

const values = [
  {
    icon: <ClockIcon />,
    title: 'Show up',
    description: 'We arrive when we say we will and communicate clearly. No ghosting, no excuses.',
  },
  {
    icon: <TargetIcon />,
    title: 'Own the job',
    description: 'We take pride in detail. Every task gets our full attention from start to finish.',
  },
  {
    icon: <HeartIcon />,
    title: 'Neighbourly care',
    description: "We treat your home and time with the same respect we'd want for our own.",
  },
  {
    icon: <UsersIcon />,
    title: 'Keep it simple',
    description: 'Easy quotes, transparent pricing, friendly service. No runaround.',
  },
];

const services = [
  { icon: <HomeIcon />, label: 'Home & end-of-lease cleaning' },
  { icon: <WindowIcon />, label: 'Window cleaning (single & multi-storey)' },
  { icon: <LeafIcon />, label: 'Yard care & light maintenance' },
  { icon: <TruckIcon />, label: 'Dump runs & item removals' },
  { icon: <CarIcon />, label: 'Car cleaning & detailing' },
];

const customers = [
  'Busy families & renters',
  'NDIS participants & support coordinators',
  'Home sellers & property managers',
  'Small offices & local shops',
];

const credentials = [
  { title: 'NDIS-ready', desc: 'Experience working with plans & reporting needs' },
  { title: 'NDIS Worker Screening / Blue Card', desc: 'Mandatory checks held by our workers' },
  { title: 'First Aid', desc: 'Up-to-date first aid certifications' },
  { title: 'Insured', desc: 'Public liability insurance for peace of mind' },
  { title: 'Invoicing options', desc: 'Invoices suitable for self-managed & plan-managed participants' },
  { title: 'Transport available', desc: 'Support workers with own vehicles when required' },
];

const timeline = [
  { year: '2023', event: 'First jobs & early referrals' },
  { year: '2024', event: 'Expanded to windows, yard care & dump runs' },
  { year: '2025', event: 'NDIS-friendly workflows & simple online booking' },
];

const team = [
  { name: 'Jackson Taylor', role: 'Founder / Operations Director', initials: 'JT', color: brand.primary },
  { name: 'Silvan', role: 'Field Lead / Community Representative', initials: 'S', color: '#0ea5e9' },
];

const stats = [
  { value: '250+', label: 'Jobs completed' },
  { value: '4.9/5', label: 'Avg. rating' },
  { value: '70%+', label: 'Repeat customers' },
];

export default function AboutPage() {
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
            Meet the crew
          </p>

          <h1
            className="mt-4 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]"
            style={{ color: brand.text }}
          >
            Your local mates,
            <br />
            <span style={{ color: brand.primary }}>not a faceless platform.</span>
          </h1>

          <p
            className="mt-5 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
            style={{ color: brand.muted }}
          >
            We&apos;re Buds at Work — a small team from Logan building a simple promise:
            show up on time, do the job properly, and treat people like neighbours.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/services"
              className="rounded-full px-7 py-3.5 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
              style={{ background: brand.primary, color: '#fff' }}
            >
              View services
            </Link>
            <Link
              href="/contact"
              className="rounded-full px-7 py-3.5 text-base font-semibold border-2 hover:bg-white/80 transition-colors"
              style={{ borderColor: brand.primary, color: brand.primary }}
            >
              Get in touch
            </Link>
          </div>
        </section>

        {/* STATS BAR */}
        <section className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className={cx('rounded-2xl p-6 text-center', glass)}
            >
              <div className="text-2xl md:text-3xl font-bold" style={{ color: brand.primary }}>
                {stat.value}
              </div>
              <div className="mt-1 text-xs md:text-sm tracking-wide uppercase" style={{ color: brand.muted }}>
                {stat.label}
              </div>
            </div>
          ))}
        </section>

        {/* VALUES */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
              What we stand for
            </h2>
            <p className="mt-2 text-base" style={{ color: brand.muted }}>
              The principles that guide every job we take on
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {values.map((v, i) => (
              <div
                key={i}
                className={cx('rounded-2xl p-6 transition-all hover:shadow-lg hover:-translate-y-0.5', glass)}
              >
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
                  style={{ background: `${brand.primary}15`, color: brand.primary }}
                >
                  {v.icon}
                </div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: brand.text }}>
                  {v.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: brand.muted }}>
                  {v.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* WHAT WE DO / WHO WE HELP */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className={cx('rounded-2xl p-6', glass)}>
            <h3 className="font-semibold text-lg mb-4" style={{ color: brand.text }}>
              What we do
            </h3>
            <ul className="space-y-3">
              {services.map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: `${brand.primary}15`, color: brand.primary }}
                  >
                    {s.icon}
                  </span>
                  <span className="text-sm" style={{ color: brand.text }}>
                    {s.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className={cx('rounded-2xl p-6', glass)}>
            <h3 className="font-semibold text-lg mb-4" style={{ color: brand.text }}>
              Who we help
            </h3>
            <ul className="space-y-3">
              {customers.map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: `${brand.primary}20`, color: brand.primary }}
                  >
                    <CheckIcon />
                  </span>
                  <span className="text-sm" style={{ color: brand.text }}>
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CREDENTIALS */}
        <section className={cx('rounded-3xl p-8 md:p-10', glassSoft)}>
          <div className="text-center mb-8">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
              style={{ background: `${brand.primary}15`, color: brand.primary }}
            >
              <ShieldIcon />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: brand.text }}>
              Credentials & checks
            </h2>
            <p className="mt-2 text-base max-w-xl mx-auto" style={{ color: brand.muted }}>
              Peace of mind for you and your family
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {credentials.map((cred, i) => (
              <div
                key={i}
                className="rounded-xl p-4 bg-white/60 border border-black/5"
              >
                <h4 className="font-medium text-sm" style={{ color: brand.text }}>
                  {cred.title}
                </h4>
                <p className="mt-1 text-xs" style={{ color: brand.muted }}>
                  {cred.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* STORY & TEAM */}
        <section className="grid md:grid-cols-2 gap-8 items-start">
          {/* Story */}
          <div>
            <p className="text-sm font-medium mb-3" style={{ color: brand.primary }}>
              Our story
            </p>
            <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ color: brand.text }}>
              Started as mates helping neighbours
            </h2>
            <p className="text-base leading-relaxed mb-6" style={{ color: brand.muted }}>
              Buds at Work began with two friends lending a hand around the neighbourhood.
              Word spread, more folks asked for help, and before long we had a small crew
              delivering reliable work across Logan and South Brisbane.
            </p>

            <div className="space-y-4">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span
                    className="flex-shrink-0 w-14 text-sm font-semibold"
                    style={{ color: brand.primary }}
                  >
                    {t.year}
                  </span>
                  <span className="text-sm" style={{ color: brand.text }}>
                    {t.event}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className={cx('rounded-2xl p-6', glass)}>
            <h3 className="font-semibold text-lg mb-4" style={{ color: brand.text }}>
              The team
            </h3>
            <div className="space-y-4">
              {team.map((member, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 rounded-xl p-4 bg-white/60 border border-black/5"
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                    style={{ background: member.color }}
                  >
                    {member.initials}
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: brand.text }}>
                      {member.name}
                    </div>
                    <div className="text-xs" style={{ color: brand.muted }}>
                      {member.role}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs" style={{ color: brand.muted }}>
              *We partner with trusted support workers and vetted local trades as needed.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section
          className="rounded-3xl p-8 md:p-10 text-center"
          style={{ background: `${brand.primary}08` }}
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-3" style={{ color: brand.text }}>
            Ready when you are
          </h2>
          <p className="text-base max-w-lg mx-auto mb-6" style={{ color: brand.muted }}>
            Tell us what you need — cleaning, windows, yard care, dump runs, or car detailing —
            and we&apos;ll give you a simple quote with no surprises.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold shadow-lg hover:shadow-xl transition-shadow"
              style={{ background: brand.primary, color: '#fff' }}
            >
              Get a quote <ArrowRightIcon />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-base font-semibold border-2 hover:bg-white/60 transition-colors"
              style={{ borderColor: brand.primary, color: brand.primary }}
            >
              Ask a question
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
