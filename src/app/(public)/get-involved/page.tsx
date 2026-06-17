'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SponsorModal from './SponsorModal';

const palette = {
  green: '#003A34',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  mutedGreen: '#3D6353',
  ink: '#14231F',
  soft: '#FFF9EB',
};

const heroImage =
  'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2200&q=80';
const workImage =
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1800&q=80';
const partnerImage =
  'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1800&q=80';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function Icon({ name, className = 'h-6 w-6' }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M12 12v2" />
      </>
    ),
    tools: (
      <>
        <path d="m14.7 6.3 3 3M4 20l6.8-6.8" />
        <path d="M19.7 7.3a4.6 4.6 0 0 1-6 5.9L7 20a2.1 2.1 0 0 1-3-3l6.8-6.8a4.6 4.6 0 0 1 5.9-6l-3.2 3.2 3 3 3.2-3.1Z" />
      </>
    ),
    partner: (
      <>
        <path d="M11 17 5 11a3.5 3.5 0 0 1 5-5l2 2 2-2a3.5 3.5 0 0 1 5 5l-6 6a1.4 1.4 0 0 1-2 0Z" />
        <path d="m12 8 2.5 2.5M9.5 10.5 12 13" />
      </>
    ),
    training: (
      <>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        <path d="M9 7h7M9 11h5" />
      </>
    ),
    arrow: <path d="M5 12h14M13 5l7 7-7 7" />,
    mower: (
      <>
        <path d="M4 16h11l4-9" />
        <circle cx="6" cy="18" r="2" />
        <circle cx="15" cy="18" r="2" />
        <path d="M3 13h9M17 7h4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" />
      </>
    ),
  };

  return (
    <svg {...iconProps} className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const stats = [
  { value: '1,240+', label: 'Jobs Completed' },
  { value: '38+', label: 'Participants Supported' },
  { value: '72+', label: 'Employment Opportunities Created' },
  { value: '860+', label: 'Training Hours Delivered' },
];

const movementPaths = [
  {
    icon: 'briefcase',
    title: 'Fund Jobs',
    body: 'Help create paid work opportunities.',
    cta: 'Contribute Now',
  },
  {
    icon: 'tools',
    title: 'Donate Equipment',
    body: 'Donate tools, trailers, safety gear and resources.',
    cta: 'Donate Equipment',
  },
  {
    icon: 'partner',
    title: 'Hire Through Buds',
    body: 'Create real paid employment opportunities.',
    cta: 'Hire Someone',
  },
  {
    icon: 'training',
    title: 'Share Your Skills',
    body: 'Provide training, mentoring or workplace experience.',
    cta: 'Get Involved',
  },
];

const pathwayGoals = [
  {
    icon: 'mower',
    title: 'Help Create 50 More Lawn Care Shifts',
    body: 'A commercial mower allows participants to take on more paid work opportunities.',
    raised: 1116,
    goal: 1800,
    urgency: '$684 still needed.',
  },
  {
    icon: 'users',
    title: 'Fund Our Next Participant',
    body: 'Training, uniforms and supported work routines help one more person start earning.',
    raised: 1080,
    goal: 1500,
    urgency: '$420 still needed.',
  },
  {
    icon: 'shield',
    title: 'Help Us Launch 10 More Workers',
    body: 'Safety training and workplace readiness unlock more shifts with local employers.',
    raised: 2750,
    goal: 3600,
    urgency: '3 positions remaining to fund.',
  },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function ActionButton({
  children,
  variant = 'primary',
  onClick,
  href,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'light';
  onClick?: () => void;
  href?: string;
}) {
  const base =
    'inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  const styles = {
    primary: {
      background: palette.mustard,
      color: palette.green,
      boxShadow: '0 18px 36px rgba(0, 58, 52, 0.18)',
    },
    secondary: {
      background: 'rgba(255,255,255,0.12)',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.55)',
    },
    light: {
      background: '#fff',
      color: palette.green,
      border: '1px solid rgba(0,58,52,0.16)',
      boxShadow: '0 14px 30px rgba(0, 58, 52, 0.10)',
    },
  };

  if (href) {
    return (
      <Link href={href} className={base} style={styles[variant]}>
        {children}
        <Icon name="arrow" className="h-4 w-4" />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={base} style={styles[variant]}>
      {children}
      <Icon name="arrow" className="h-4 w-4" />
    </button>
  );
}

function SectionIntro({
  eyebrow,
  title,
  children,
  light = false,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  light?: boolean;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p
        className="text-xs font-bold uppercase tracking-[0.18em]"
        style={{ color: light ? palette.cream : palette.mutedGreen }}
      >
        {eyebrow}
      </p>
      <h2
        className="mt-3 text-3xl font-black leading-tight md:text-5xl"
        style={{ color: light ? '#fff' : palette.green }}
      >
        {title}
      </h2>
      <p
        className="mx-auto mt-4 max-w-2xl text-base leading-8 md:text-lg"
        style={{ color: light ? 'rgba(255,255,255,0.78)' : '#52645D' }}
      >
        {children}
      </p>
    </div>
  );
}

const PRESET_AMOUNTS = ['$25', '$50', '$100'] as const;

function ContributionButtons({
  onDonate,
  disabled,
}: {
  onDonate: (amountCents: number) => void;
  disabled?: boolean;
}) {
  const [showCustom, setShowCustom] = React.useState(false);
  const [customValue, setCustomValue] = React.useState('');

  function handlePreset(label: string) {
    const dollars = parseInt(label.replace('$', ''), 10);
    onDonate(dollars * 100);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dollars = parseFloat(customValue);
    if (!Number.isFinite(dollars) || dollars < 5) return;
    onDonate(Math.round(dollars * 100));
    setCustomValue('');
    setShowCustom(false);
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PRESET_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            disabled={disabled}
            onClick={() => handlePreset(amount)}
            className="min-h-[52px] rounded-full border px-4 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{
              background: '#fff',
              borderColor: 'rgba(255,255,255,0.55)',
              color: palette.green,
            }}
          >
            {amount}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom((v) => !v)}
          className="min-h-[52px] rounded-full border px-4 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{
            background: palette.mustard,
            borderColor: palette.mustard,
            color: palette.green,
          }}
        >
          Choose Amount
        </button>
      </div>

      {showCustom && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
              style={{ color: palette.mutedGreen }}
            >
              $
            </span>
            <input
              type="number"
              min="5"
              max="5000"
              step="1"
              placeholder="Amount"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              className="w-full rounded-full border py-3 pl-8 pr-4 text-sm font-bold focus:outline-none focus:ring-2"
              style={{
                borderColor: 'rgba(0,58,52,0.2)',
                color: palette.green,
                background: '#fff',
              }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !customValue || parseFloat(customValue) < 5}
            className="rounded-full px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: palette.green, color: '#fff' }}
          >
            Donate
          </button>
        </form>
      )}
    </div>
  );
}

export default function GetInvolvedPage() {
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const openSponsorModal = () => setShowSponsorModal(true);

  const [donating, setDonating] = useState(false);

  async function handleDonate(amountCents: number) {
    if (donating) return;
    setDonating(true);
    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[donate] checkout error:', data.error);
        setDonating(false);
      }
    } catch (err) {
      console.error('[donate] fetch failed:', err);
      setDonating(false);
    }
  }

  return (
    <div className="-mx-4 -mt-8 overflow-hidden md:-mx-8 md:-mt-10">
      <section
        className="relative isolate flex min-h-[92svh] items-end overflow-hidden px-4 pb-10 pt-32 md:px-8 md:pb-14"
        style={{ backgroundColor: palette.green }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 scale-105 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,58,52,0.96) 0%, rgba(0,58,52,0.82) 50%, rgba(0,58,52,0.44) 100%), linear-gradient(0deg, rgba(0,58,52,0.98) 0%, rgba(0,58,52,0.12) 62%)',
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-end">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: palette.cream }}>
              Buds At Work
            </p>
            <h1 className="mt-4 max-w-4xl text-5xl font-black leading-[0.96] text-white md:text-7xl lg:text-8xl">
              Help Create Jobs
            </h1>
            <div className="mt-6 max-w-3xl space-y-3 text-xl font-semibold leading-8 text-white md:text-2xl md:leading-9">
              <p>People with disabilities don&apos;t need sympathy.</p>
              <p>They need opportunity.</p>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-8 text-white/82 md:text-lg">
              Every contribution helps create real paid employment, workplace skills and greater
              independence.
            </p>
          </div>

          <div className="rounded-lg border border-white/20 bg-white/14 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-md">
            <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: palette.cream }}>
              Contribute now
            </p>
            <p className="mt-3 text-2xl font-black leading-tight text-white">
              Put money directly behind the next paid shift.
            </p>
            <div className="mt-6">
              <ContributionButtons onDonate={handleDonate} disabled={donating} />
            </div>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Contributions help fund equipment, training, supervision and paid employment
              pathways.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-12 md:px-8" style={{ background: '#fff' }}>
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-white p-5 shadow-[0_14px_36px_rgba(0,58,52,0.08)]"
              style={{ borderColor: 'rgba(0,58,52,0.12)' }}
            >
              <div className="text-3xl font-black md:text-4xl" style={{ color: palette.green }}>
                {stat.value}
              </div>
              <div className="mt-2 text-xs font-bold uppercase leading-5 tracking-[0.14em]" style={{ color: palette.mutedGreen }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.soft }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative min-h-[430px] overflow-hidden rounded-lg shadow-[0_30px_80px_rgba(0,58,52,0.16)]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${workImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#003A34]/82 via-[#003A34]/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 border-l-4 bg-white/16 p-5 text-white backdrop-blur-xl" style={{ borderColor: palette.mustard }}>
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: palette.cream }}>
                Proof of work
              </p>
              <p className="mt-2 text-2xl font-black">This is already creating paid work.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.mutedGreen }}>
              Show Impact
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl" style={{ color: palette.green }}>
              Opportunity turns support into employment.
            </h2>
            <div className="mt-6 space-y-4 text-lg leading-8" style={{ color: '#4E625A' }}>
              <p>
                Buds At Work creates practical, paid jobs where participants can build confidence,
                learn workplace routines and be seen for what they can do.
              </p>
              <p className="font-bold" style={{ color: palette.green }}>
                The mission is simple: more paid shifts, more skills, more independence.
              </p>
              <p>
                Donations, equipment, training and business partnerships all feed the same outcome:
                real employment pathways for people with disabilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="movement" className="px-4 py-20 md:px-8 md:py-28" style={{ background: '#fff' }}>
        <SectionIntro eyebrow="Join the movement" title="Four ways to create the next job">
          The first action is funding employment. The other paths help turn community support into
          more paid work opportunities.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {movementPaths.map((card) => (
            <article
              key={card.title}
              className="group flex min-h-[300px] flex-col rounded-lg border bg-white p-6 shadow-[0_18px_45px_rgba(0,58,52,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(0,58,52,0.14)]"
              style={{ borderColor: 'rgba(0,58,52,0.12)' }}
            >
              <div
                className="grid h-14 w-14 place-items-center rounded-lg"
                style={{ background: '#F5E5BF', color: palette.green }}
              >
                <Icon name={card.icon} />
              </div>
              <h3 className="mt-8 text-2xl font-black" style={{ color: palette.green }}>
                {card.title}
              </h3>
              <p className="mt-3 flex-1 leading-7" style={{ color: '#53675F' }}>
                {card.body}
              </p>
              <button
                type="button"
                onClick={openSponsorModal}
                className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all group-hover:translate-x-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: palette.green, color: '#fff' }}
              >
                {card.cta}
                <Icon name="arrow" className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.green }}>
        <SectionIntro eyebrow="Fund employment pathways" title="Fund the outcome, not the item" light>
          Every practical goal is framed around the paid work it unlocks for participants.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3">
          {pathwayGoals.map((goal) => {
            const percent = Math.round((goal.raised / goal.goal) * 100);

            return (
              <article
                key={goal.title}
                className="rounded-lg border border-white/15 bg-white p-6 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-lg"
                    style={{ background: palette.cream, color: palette.green }}
                  >
                    <Icon name={goal.icon} className="h-6 w-6" />
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]"
                    style={{ background: '#F5E5BF', color: palette.green }}
                  >
                    {percent}% funded
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-black leading-tight" style={{ color: palette.green }}>
                  {goal.title}
                </h3>
                <p className="mt-3 min-h-[84px] leading-7" style={{ color: '#53675F' }}>
                  {goal.body}
                </p>
                <p className="mt-4 text-lg font-black" style={{ color: palette.green }}>
                  {formatCurrency(goal.raised)} raised of {formatCurrency(goal.goal)}
                </p>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#E7E0CA]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, background: palette.mustard }}
                  />
                </div>
                <p className="mt-4 rounded-lg px-4 py-3 text-sm font-black" style={{ background: palette.soft, color: palette.green }}>
                  {goal.urgency}
                </p>
                <div className="mt-5">
                  <ContributionButtons onDonate={handleDonate} disabled={donating} />
                </div>
                <button
                  type="button"
                  onClick={openSponsorModal}
                  className="mt-5 w-full rounded-full px-4 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ background: palette.green, color: '#fff' }}
                >
                  Fund This Goal
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.soft }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.mutedGreen }}>
              Business sponsorships
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl" style={{ color: palette.green }}>
              Become a founding employment partner
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8" style={{ color: '#52645D' }}>
              Your business can help create paid jobs and workplace pathways for people with
              disabilities.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ActionButton onClick={openSponsorModal}>Partner With Us</ActionButton>
              <ActionButton href="#movement" variant="light">
                See Pathways
              </ActionButton>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-lg shadow-[0_28px_70px_rgba(0,58,52,0.16)]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${partnerImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#003A34]/82 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <p className="text-3xl font-black leading-tight">Turn local work into local jobs.</p>
              <p className="mt-2 leading-7 text-white/78">
                Sponsor shifts, refer work, host training or create direct employment pathways.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-20 text-center md:px-8 md:py-28" style={{ background: palette.green }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative mx-auto max-w-4xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.cream }}>
            Help create the next job
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight text-white md:text-6xl">
            Help create the next job
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-white/80">
            Every dollar, every tool, every opportunity creates meaningful paid employment for
            someone who deserves a chance.
          </p>
          <div className="mt-8 flex justify-center">
            <ActionButton onClick={openSponsorModal}>Contribute Now</ActionButton>
          </div>
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
    </div>
  );
}
