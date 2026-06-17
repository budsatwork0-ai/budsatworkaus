'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import SponsorModal from './SponsorModal';
import FeedbackModal from './FeedbackModal';

const palette = {
  green: '#003A34',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  beige: '#DDCDA2',
  mutedGreen: '#3D6353',
  ink: '#14231F',
  soft: '#FFF9EB',
};

const heroImage =
  'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=2200&q=80';
const workImage =
  'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1600&q=80';
const communityImage =
  'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=80';

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
    skills: (
      <>
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c3.6 2.7 8.4 2.7 12 0v-5M19 11.5V17" />
      </>
    ),
    leaf: (
      <>
        <path d="M6 21c0-7 5-12 15-18 0 10-5 15-12 15H6Z" />
        <path d="M6 21c2-5 6-8 11-10" />
      </>
    ),
    community: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.8M16 3.2a4 4 0 0 1 0 7.6" />
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
    mentor: (
      <>
        <path d="M12 21s-7-4.4-7-11a7 7 0 0 1 14 0c0 6.6-7 11-7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
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
    trailer: (
      <>
        <path d="M3 8h13v8H3zM16 13h4l1 3" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    sparkle: (
      <>
        <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
        <path d="m6 6 2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
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
  { value: '860+', label: 'Training Hours Delivered' },
  { value: '72+', label: 'Employment Opportunities Created' },
];

const impactCards = [
  { icon: 'briefcase', title: 'Employment', body: 'Creating meaningful paid work opportunities.' },
  { icon: 'skills', title: 'Skills', body: 'Developing workplace experience and confidence.' },
  { icon: 'leaf', title: 'Independence', body: 'Supporting personal growth and self-reliance.' },
  { icon: 'community', title: 'Community', body: 'Building stronger and more inclusive communities.' },
];

const helpCards = [
  {
    icon: 'briefcase',
    title: 'Support Employment',
    body: 'Help fund equipment, uniforms, training, and opportunities.',
    cta: 'Support employment',
  },
  {
    icon: 'tools',
    title: 'Donate Equipment',
    body: 'Donate tools, trailers, lawn equipment, safety gear, and workplace resources.',
    cta: 'Offer equipment',
  },
  {
    icon: 'partner',
    title: 'Become a Business Partner',
    body: 'Sponsor opportunities, refer work, mentor participants, and support employment pathways.',
    cta: 'Partner with Buds',
  },
  {
    icon: 'training',
    title: 'Training Partners',
    body: 'Provide qualifications, workshops, certifications, and workplace training.',
    cta: 'Share training',
  },
  {
    icon: 'community',
    title: 'Employment Partners',
    body: 'Offer meaningful employment opportunities and inclusive workplaces.',
    cta: 'Create pathways',
  },
  {
    icon: 'mentor',
    title: 'Volunteer & Mentor',
    body: 'Support participants through encouragement, guidance, and mentorship.',
    cta: 'Become a mentor',
  },
];

const wishlist = [
  {
    icon: 'mower',
    title: 'Commercial Mower',
    goal: '$1,800',
    raised: 62,
    impact: 'Supports additional paid lawn care opportunities.',
  },
  {
    icon: 'trailer',
    title: 'Trailer',
    goal: '$4,000',
    raised: 41,
    impact: 'Allows transport of equipment and participants.',
  },
  {
    icon: 'shield',
    title: 'White Card Training',
    goal: '$500',
    raised: 78,
    impact: 'Improves participant employment readiness.',
  },
  {
    icon: 'training',
    title: 'First Aid Training',
    goal: '$600',
    raised: 55,
    impact: 'Builds workplace confidence and safety.',
  },
  {
    icon: 'sparkle',
    title: 'Window Cleaning Equipment',
    goal: '$1,200',
    raised: 69,
    impact: 'Creates additional paid work opportunities.',
  },
];

const stories = [
  {
    name: 'Participant spotlight',
    goal: 'Building confidence with customer-facing work.',
    skills: 'Team routines, safe equipment use, reliability, communication.',
    journey: 'From supported training shifts to regular paid work with a crew lead.',
    quote: 'I want to learn more skills and feel proud of the work I do.',
  },
  {
    name: 'Future crew member',
    goal: 'Learning lawn care and workplace safety.',
    skills: 'Tool handling, preparation, site clean-up, time management.',
    journey: 'Training pathway designed around strengths, pace, and practical goals.',
    quote: 'Having a real job helps me feel independent.',
  },
  {
    name: 'Employment pathway',
    goal: 'Preparing for long-term inclusive employment.',
    skills: 'Qualifications, mentoring, consistent work habits, confidence.',
    journey: 'Partner-supported work experience toward open employment.',
    quote: 'People see what I can do when I get the chance.',
  },
];

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
        style={{ color: light ? palette.beige : palette.mutedGreen }}
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

export default function GetInvolvedPage() {
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [activeStory, setActiveStory] = useState(0);

  const currentStory = stories[activeStory];
  const mailHref = useMemo(
    () =>
      `mailto:admin@budsatwork.com?subject=${encodeURIComponent(
        'Creating employment opportunities with Buds At Work'
      )}`,
    []
  );

  return (
    <div className="-mx-4 -mt-8 overflow-hidden md:-mx-8 md:-mt-10">
      <section
        className="relative isolate flex min-h-[calc(100svh-1px)] items-end overflow-hidden px-4 pb-10 pt-32 md:px-8 md:pb-12"
        style={{ backgroundColor: palette.green }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 scale-105 bg-cover bg-center motion-safe:animate-[heroDrift_18s_ease-in-out_infinite_alternate]"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,58,52,0.95) 0%, rgba(0,58,52,0.78) 42%, rgba(0,58,52,0.42) 100%), linear-gradient(0deg, rgba(0,58,52,0.96) 0%, rgba(0,58,52,0.10) 56%)',
          }}
        />
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-white backdrop-blur">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: palette.mustard }} />
              Social enterprise employment pathways
            </div>
            <h1 className="mt-6 max-w-5xl text-4xl font-black leading-[1.02] text-white md:text-6xl lg:text-7xl">
              Creating Paid Employment Opportunities for People with Disabilities
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-white/82 md:text-xl">
              Every job, every tool, every partnership, and every opportunity helps people with
              disabilities gain confidence, skills, independence, and meaningful paid employment.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ActionButton onClick={() => setShowSponsorModal(true)}>Support Employment</ActionButton>
              <ActionButton href="#partner" variant="secondary">
                Become a Partner
              </ActionButton>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="rounded-[28px] border border-white/18 bg-white/12 p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.16)] backdrop-blur-md md:p-5 motion-safe:animate-[statFloat_6s_ease-in-out_infinite]"
                style={{ animationDelay: `${index * 140}ms` }}
              >
                <div className="text-2xl font-black md:text-4xl">{stat.value}</div>
                <div className="mt-2 text-xs font-semibold uppercase leading-5 tracking-[0.12em] text-white/72">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.soft }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="relative min-h-[430px] overflow-hidden rounded-[36px] shadow-[0_30px_80px_rgba(0,58,52,0.16)]">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${workImage})` }} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#003A34]/80 via-[#003A34]/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 rounded-[28px] border border-white/20 bg-white/16 p-5 text-white backdrop-blur-xl">
              <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: palette.beige }}>
                Work as the pathway
              </p>
              <p className="mt-2 text-2xl font-black">Confidence grows through real paid work.</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.mutedGreen }}>
              Why Buds Exists
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl" style={{ color: palette.green }}>
              Why Buds Exists
            </h2>
            <div className="mt-6 space-y-4 text-lg leading-8" style={{ color: '#4E625A' }}>
              <p>Too many people with disabilities want to work but struggle to find employers willing to give them a chance.</p>
              <p className="font-bold" style={{ color: palette.green }}>Not because they lack ability.</p>
              <p className="font-bold" style={{ color: palette.green }}>Not because they lack motivation.</p>
              <p>But because opportunities are often limited.</p>
              <p>Buds at Work exists to change that.</p>
              <p>
                Through meaningful work, practical skills, and community support, we help create
                pathways into paid employment and greater independence.
              </p>
            </div>
            <blockquote
              className="mt-8 rounded-[28px] border-l-4 bg-white p-6 text-2xl font-black leading-snug shadow-[0_20px_50px_rgba(0,58,52,0.08)]"
              style={{ borderColor: palette.mustard, color: palette.green }}
            >
              &ldquo;Every person deserves the opportunity to contribute, grow, and be valued through meaningful work.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: '#fff' }}>
        <SectionIntro eyebrow="Our impact" title="Employment creates more than income">
          The work matters because it creates paid shifts, practical experience, confidence, and a
          stronger sense of belonging.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {impactCards.map((card, index) => (
            <article
              key={card.title}
              className="group relative min-h-[280px] overflow-hidden rounded-[30px] border bg-white p-6 shadow-[0_18px_45px_rgba(0,58,52,0.08)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_30px_70px_rgba(0,58,52,0.14)]"
              style={{ borderColor: 'rgba(0,58,52,0.12)' }}
            >
              <div
                aria-hidden="true"
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full transition-transform duration-500 group-hover:scale-125"
                style={{ background: index % 2 ? palette.cream : '#E9F0E4' }}
              />
              <div
                className="relative grid h-16 w-16 place-items-center rounded-3xl"
                style={{ background: palette.green, color: palette.mustard }}
              >
                <Icon name={card.icon} className="h-8 w-8" />
              </div>
              <div className="relative mt-10 h-16">
                <div className="absolute left-0 top-3 h-6 w-24 rounded-full" style={{ background: palette.beige }} />
                <div className="absolute left-10 top-0 h-12 w-12 rounded-full" style={{ background: palette.mustard }} />
                <div className="absolute left-24 top-5 h-8 w-16 rounded-full" style={{ background: '#E9F0E4' }} />
              </div>
              <h3 className="relative mt-8 text-2xl font-black" style={{ color: palette.green }}>
                {card.title}
              </h3>
              <p className="relative mt-2 leading-7" style={{ color: '#53675F' }}>
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="partner" className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.cream }}>
        <SectionIntro eyebrow="How you can help" title="Create opportunity from where you are">
          Businesses, trainers, employers, supporters, and mentors can all help turn everyday work
          into meaningful employment pathways.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
          {helpCards.map((card) => (
            <article
              key={card.title}
              className="group flex min-h-[330px] flex-col rounded-[30px] border bg-white p-6 shadow-[0_18px_45px_rgba(0,58,52,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_60px_rgba(0,58,52,0.14)]"
              style={{ borderColor: 'rgba(0,58,52,0.12)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div
                  className="grid h-14 w-14 place-items-center rounded-2xl"
                  style={{ background: '#F5E5BF', color: palette.green }}
                >
                  <Icon name={card.icon} />
                </div>
                <div className="relative h-20 w-24 overflow-hidden rounded-3xl" style={{ background: '#E8E0C6' }}>
                  <span className="absolute -bottom-5 left-3 h-16 w-16 rounded-full" style={{ background: palette.mustard }} />
                  <span className="absolute right-2 top-3 h-10 w-10 rounded-full" style={{ background: palette.mutedGreen }} />
                  <span className="absolute bottom-3 right-6 h-5 w-14 rounded-full bg-white/70" />
                </div>
              </div>
              <h3 className="mt-8 text-2xl font-black" style={{ color: palette.green }}>
                {card.title}
              </h3>
              <p className="mt-3 flex-1 leading-7" style={{ color: '#53675F' }}>
                {card.body}
              </p>
              <button
                type="button"
                onClick={() => setShowSponsorModal(true)}
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
        <SectionIntro eyebrow="Opportunity wishlist" title="Current Opportunity Goals" light>
          Each practical goal unlocks more paid work, safer shifts, and clearer employment pathways.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-5">
          {wishlist.map((item) => (
            <article
              key={item.title}
              className="rounded-[28px] border border-white/15 bg-white p-5 shadow-[0_22px_60px_rgba(0,0,0,0.16)]"
            >
              <div
                className="grid h-12 w-12 place-items-center rounded-2xl"
                style={{ background: palette.cream, color: palette.green }}
              >
                <Icon name={item.icon} className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-black leading-tight" style={{ color: palette.green }}>
                {item.title}
              </h3>
              <p className="mt-2 text-sm font-bold" style={{ color: palette.mutedGreen }}>
                Goal: {item.goal}
              </p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#E7E0CA]">
                <div
                  className="h-full rounded-full motion-safe:animate-[progressIn_900ms_ease-out_both]"
                  style={{ width: `${item.raised}%`, background: palette.mustard }}
                />
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.12em]" style={{ color: palette.mutedGreen }}>
                {item.raised}% pledged
              </p>
              <p className="mt-4 min-h-[72px] text-sm leading-6" style={{ color: '#53675F' }}>
                {item.impact}
              </p>
              <button
                type="button"
                onClick={() => setShowSponsorModal(true)}
                className="mt-5 w-full rounded-full px-4 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: palette.green, color: '#fff' }}
              >
                Sponsor
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.soft }}>
        <SectionIntro eyebrow="Real stories" title="Participant spotlights">
          These cards are ready for real stories as participants choose what they want to share.
        </SectionIntro>
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
          <div className="overflow-hidden rounded-[34px] bg-white shadow-[0_24px_70px_rgba(0,58,52,0.12)]">
            <div className="h-72 bg-cover bg-center" style={{ backgroundImage: `url(${communityImage})` }} />
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.mutedGreen }}>
                Future story library
              </p>
              <p className="mt-3 text-2xl font-black leading-tight" style={{ color: palette.green }}>
                Authentic participant stories, shared with consent and dignity.
              </p>
            </div>
          </div>

          <div className="rounded-[34px] bg-white p-6 shadow-[0_24px_70px_rgba(0,58,52,0.12)] md:p-8">
            <div className="flex flex-wrap gap-2">
              {stories.map((story, index) => (
                <button
                  key={story.name}
                  type="button"
                  onClick={() => setActiveStory(index)}
                  className="rounded-full px-4 py-2 text-sm font-bold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{
                    background: activeStory === index ? palette.green : '#F0E6CB',
                    color: activeStory === index ? '#fff' : palette.green,
                  }}
                >
                  Story {index + 1}
                </button>
              ))}
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-[150px_1fr]">
              <div className="grid aspect-square place-items-center rounded-[32px]" style={{ background: palette.cream }}>
                <div
                  className="grid h-24 w-24 place-items-center rounded-full text-3xl font-black"
                  style={{ background: palette.green, color: palette.mustard }}
                >
                  {activeStory + 1}
                </div>
              </div>
              <div>
                <h3 className="text-3xl font-black" style={{ color: palette.green }}>
                  {currentStory.name}
                </h3>
                <dl className="mt-5 grid gap-4">
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: palette.mutedGreen }}>
                      Their goals
                    </dt>
                    <dd className="mt-1 leading-7" style={{ color: '#53675F' }}>
                      {currentStory.goal}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: palette.mutedGreen }}>
                      Skills developed
                    </dt>
                    <dd className="mt-1 leading-7" style={{ color: '#53675F' }}>
                      {currentStory.skills}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: palette.mutedGreen }}>
                      Employment journey
                    </dt>
                    <dd className="mt-1 leading-7" style={{ color: '#53675F' }}>
                      {currentStory.journey}
                    </dd>
                  </div>
                </dl>
                <blockquote
                  className="mt-6 rounded-[24px] p-5 text-xl font-black leading-snug"
                  style={{ background: palette.cream, color: palette.green }}
                >
                  &ldquo;{currentStory.quote}&rdquo;
                </blockquote>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-20 md:px-8 md:py-28" style={{ background: palette.green }}>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-25"
          style={{ backgroundImage: `url(${communityImage})` }}
        />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.beige }}>
              The Future We&apos;re Building
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight text-white md:text-5xl">
              The Future We&apos;re Building
            </h2>
            <p className="mt-6 text-lg leading-8 text-white/80">
              We envision a future where people with disabilities have access to meaningful paid
              employment, practical workplace skills, and genuine career opportunities.
            </p>
            <p className="mt-4 text-lg leading-8 text-white/80">
              Our goal is to create pathways that lead to independence, confidence, financial
              security, and long-term success.
            </p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-5">
            {['Today', 'Skills', 'Paid Work', 'Employment', 'Independence'].map((step, index) => (
              <div key={step} className="relative rounded-[26px] border border-white/18 bg-white/12 p-5 text-white backdrop-blur">
                <div
                  className="mb-8 grid h-10 w-10 place-items-center rounded-full text-sm font-black"
                  style={{ background: palette.mustard, color: palette.green }}
                >
                  {index + 1}
                </div>
                <p className="text-xl font-black">{step}</p>
                {index < 4 && (
                  <div
                    aria-hidden="true"
                    className="absolute -right-4 top-9 hidden h-0.5 w-8 md:block"
                    style={{ background: palette.mustard }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: palette.cream }}>
        <div className="mx-auto max-w-5xl rounded-[40px] p-8 text-center shadow-[0_26px_80px_rgba(0,58,52,0.14)] md:p-14" style={{ background: '#fff' }}>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: palette.mutedGreen }}>
            Help Create Opportunity
          </p>
          <h2 className="mt-3 text-4xl font-black leading-tight md:text-6xl" style={{ color: palette.green }}>
            Help Create Opportunity
          </h2>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8" style={{ color: '#53675F' }}>
            Whether you contribute equipment, training, mentoring, sponsorship, employment
            opportunities, or financial support, you&apos;re helping create real jobs and brighter
            futures for people with disabilities.
          </p>
          <p className="mx-auto mt-6 max-w-2xl rounded-[26px] px-5 py-4 text-xl font-black leading-snug" style={{ background: palette.cream, color: palette.green }}>
            I&apos;m not helping fund a business. I&apos;m helping create meaningful paid employment opportunities for people with disabilities.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ActionButton onClick={() => setShowSponsorModal(true)}>Support Employment</ActionButton>
            <ActionButton href="#partner" variant="light">
              Become a Partner
            </ActionButton>
            <ActionButton href={mailHref} variant="light">
              Contact Us
            </ActionButton>
          </div>
          <button
            type="button"
            onClick={() => setShowFeedbackModal(true)}
            className="mt-6 text-sm font-bold underline underline-offset-4"
            style={{ color: palette.mutedGreen }}
          >
            Share an idea for creating more employment opportunities
          </button>
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
      <FeedbackModal open={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      <style jsx global>{`
        @keyframes heroDrift {
          from {
            transform: scale(1.04) translate3d(0, 0, 0);
          }
          to {
            transform: scale(1.1) translate3d(-18px, 12px, 0);
          }
        }

        @keyframes statFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes progressIn {
          from {
            transform: scaleX(0);
            transform-origin: left;
          }
          to {
            transform: scaleX(1);
            transform-origin: left;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .motion-safe\\:animate-\\[heroDrift_18s_ease-in-out_infinite_alternate\\],
          .motion-safe\\:animate-\\[statFloat_6s_ease-in-out_infinite\\],
          .motion-safe\\:animate-\\[progressIn_900ms_ease-out_both\\] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
