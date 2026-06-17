'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SponsorModal from './SponsorModal';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';

// ── Brand palette (consistent with the rest of the site) ─────────────────────
const g = {
  green: '#003A34',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  mutedGreen: '#3D6353',
  soft: '#FFF9EB',
  bodyText: '#52645D',
};

// ── Fallback hero — replace with real Buds At Work photo when available ───────
const FALLBACK_HERO =
  'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?auto=format&fit=crop&w=2200&q=80';

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatAUD(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  items: FundraisingItem[];
  stats: Omit<SiteImpactStats, 'id' | 'updated_at'>;
}

// ── Donation helpers ──────────────────────────────────────────────────────────
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
            className="min-h-[52px] rounded-full border border-white/55 bg-white px-4 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
            style={{ color: g.green }}
          >
            {amount}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowCustom((v) => !v)}
          className="min-h-[52px] rounded-full px-4 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          style={{ background: g.mustard, color: g.green }}
        >
          Choose Amount
        </button>
      </div>

      {showCustom && (
        <form onSubmit={handleCustomSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <span
              className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold"
              style={{ color: g.mutedGreen }}
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
              style={{ borderColor: 'rgba(0,58,52,0.2)', color: g.green, background: '#fff' }}
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={disabled || !customValue || parseFloat(customValue) < 5}
            className="rounded-full px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ background: g.green, color: '#fff' }}
          >
            Donate
          </button>
        </form>
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm font-semibold" style={{ color: g.green }}>
        <span>{formatAUD(raised)} raised</span>
        <span className="text-xs font-bold" style={{ color: g.mutedGreen }}>
          {pct}% of {formatAUD(goal)}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full" style={{ background: '#E7E0CA' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: g.mustard }}
        />
      </div>
    </div>
  );
}

// ── Category badge ────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  equipment: 'Equipment',
  uniforms: 'Uniforms',
  training: 'Training',
  transport: 'Transport',
  technology: 'Technology',
  general: 'General',
};

// ── Main client component ─────────────────────────────────────────────────────
export default function GetInvolvedClient({ items, stats }: Props) {
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [donating, setDonating] = useState(false);

  const featuredItem = items.find((i) => i.is_featured) ?? items[0];
  const heroImage = featuredItem?.image_url ?? FALLBACK_HERO;

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
        setDonating(false);
      }
    } catch {
      setDonating(false);
    }
  }

  function handleItemCTA(item: FundraisingItem) {
    if (item.payment_url) {
      window.open(item.payment_url, '_blank', 'noopener,noreferrer');
    } else {
      setShowSponsorModal(true);
    }
  }

  const impactMetrics = [
    { value: stats.participants_supported, label: 'Participant Supported', suffix: '' },
    { value: stats.paid_jobs_completed, label: 'Paid Jobs Completed', suffix: '' },
    { value: stats.training_hours_delivered, label: 'Training Hours Delivered', suffix: '' },
    {
      value: stats.employment_opportunities_created,
      label: 'Employment Opportunities',
      suffix: '',
    },
  ];

  return (
    <div className="-mx-4 -mt-8 overflow-hidden md:-mx-8 md:-mt-10">

      {/* ── Section 1: Hero ──────────────────────────────────────────────────── */}
      <section
        className="relative isolate flex min-h-[90svh] items-end overflow-hidden px-4 pb-12 pt-32 md:px-8 md:pb-16"
        style={{ backgroundColor: g.green }}
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
              'linear-gradient(90deg, rgba(0,58,52,0.97) 0%, rgba(0,58,52,0.85) 50%, rgba(0,58,52,0.5) 100%), linear-gradient(0deg, rgba(0,58,52,0.99) 0%, rgba(0,58,52,0.1) 62%)',
          }}
        />

        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_420px] lg:items-end">
          <div className="max-w-3xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.22em]"
              style={{ color: g.cream }}
            >
              Buds At Work — Logan &amp; South Brisbane
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[0.94] text-white md:text-7xl lg:text-8xl">
              Help Create The Next Paid Shift
            </h1>
            <div className="mt-6 space-y-2 text-lg leading-8 text-white/85 md:text-xl">
              <p>
                Buds At Work is helping Silvan build confidence, workplace skills and independence
                through real paid work.
              </p>
              <p>
                Right now we&apos;re raising funds for the equipment, training and resources needed to
                create more opportunities.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#wishlist"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,58,52,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: g.mustard, color: g.green }}
              >
                Fund The Next Shift
                <Arrow />
              </a>
              <a
                href="#ways-to-help"
                className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 bg-white/12 px-7 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                See What We Need
              </a>
            </div>
          </div>

          {/* Contribution widget */}
          <div className="rounded-2xl border border-white/20 bg-white/12 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: g.cream }}
            >
              Contribute now
            </p>
            <p className="mt-3 text-2xl font-black leading-tight text-white">
              Put money directly behind the next paid shift.
            </p>
            <div className="mt-6">
              <ContributionButtons onDonate={handleDonate} disabled={donating} />
            </div>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Contributions fund equipment, training, supervision and paid employment pathways.
            </p>
          </div>
        </div>
      </section>

      {/* ── Section 2: Who You're Helping ───────────────────────────────────── */}
      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: g.soft }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: g.mutedGreen }}
          >
            Who you&apos;re helping right now
          </p>
          <h2
            className="mt-3 max-w-2xl text-3xl font-black leading-tight md:text-5xl"
            style={{ color: g.green }}
          >
            Helping Silvan build a real working life.
          </h2>

          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-start">
            <div className="space-y-5 text-lg leading-8" style={{ color: g.bodyText }}>
              <p>
                Buds At Work is helping Silvan build workplace confidence, practical skills and
                independence through real paid work opportunities in Logan and South Brisbane.
              </p>
              <p>
                Focus areas include lawn care, window cleaning, equipment handling, workplace routines
                and community participation.
              </p>
              <p className="font-bold" style={{ color: g.green }}>
                Right now Silvan is the focus. That&apos;s okay. Real stories are more powerful than
                inflated numbers.
              </p>
              <p>
                As funding grows, Buds At Work will take on more participants. Every item on the
                wishlist is a direct step toward that.
              </p>
            </div>

            {/* Impact metrics — live from DB */}
            <div className="grid grid-cols-2 gap-4">
              {impactMetrics.map((m) => (
                <div
                  key={m.label}
                  className="rounded-2xl border bg-white p-5 shadow-[0_14px_36px_rgba(0,58,52,0.08)]"
                  style={{ borderColor: 'rgba(0,58,52,0.1)' }}
                >
                  <div
                    className="text-4xl font-black leading-none md:text-5xl"
                    style={{ color: g.green }}
                  >
                    {m.value > 0 ? m.value.toLocaleString() : '—'}
                  </div>
                  <div
                    className="mt-2 text-xs font-bold uppercase leading-5 tracking-[0.14em]"
                    style={{ color: g.mutedGreen }}
                  >
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 3: Wishlist / Fundraising Items ──────────────────────────── */}
      <section
        id="wishlist"
        className="px-4 py-20 md:px-8 md:py-28"
        style={{ background: g.green }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: g.cream }}
          >
            Fund employment pathways
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-white md:text-5xl">
            What we&apos;re raising money for
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/75">
            Every item below connects directly to a paid work opportunity. You&apos;re not funding
            equipment — you&apos;re funding opportunity.
          </p>

          {items.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-white/20 bg-white/10 p-10 text-center backdrop-blur-sm">
              <p className="text-lg text-white/75">
                New wishlist items are being prepared. Check back soon, or{' '}
                <a
                  href="mailto:hello@budsatwork.com"
                  className="font-bold text-white underline"
                >
                  contact us
                </a>{' '}
                to help directly.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_22px_60px_rgba(0,0,0,0.16)]"
                >
                  {/* Image */}
                  {item.image_url ? (
                    <div className="relative h-48 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>
                  ) : (
                    <div
                      className="flex h-32 items-center justify-center"
                      style={{ background: '#F5E5BF' }}
                    >
                      <span
                        className="text-xs font-bold uppercase tracking-wider"
                        style={{ color: g.mutedGreen }}
                      >
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-1 flex-col p-6">
                    {/* Category badge */}
                    <span
                      className="inline-block w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]"
                      style={{ background: '#F5E5BF', color: g.green }}
                    >
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>

                    <h3
                      className="mt-4 text-xl font-black leading-tight"
                      style={{ color: g.green }}
                    >
                      {item.title}
                    </h3>

                    {item.short_reason && (
                      <p className="mt-3 flex-1 text-sm leading-7" style={{ color: '#53675F' }}>
                        {item.short_reason}
                      </p>
                    )}

                    {item.who_it_helps && (
                      <p className="mt-3 text-xs font-bold" style={{ color: g.mutedGreen }}>
                        Helps: {item.who_it_helps}
                      </p>
                    )}

                    {item.employment_impact && (
                      <p className="mt-1 text-xs" style={{ color: '#53675F' }}>
                        {item.employment_impact}
                      </p>
                    )}

                    {item.goal_amount_cents > 0 && (
                      <div className="mt-5">
                        <ProgressBar
                          raised={item.raised_amount_cents}
                          goal={item.goal_amount_cents}
                        />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleItemCTA(item)}
                      className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ background: g.green, color: '#fff' }}
                    >
                      {item.cta_label}
                      <Arrow />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Work We've Already Started ───────────────────────────── */}
      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: g.mutedGreen }}
          >
            Real progress
          </p>
          <h2
            className="mt-3 text-3xl font-black leading-tight md:text-5xl"
            style={{ color: g.green }}
          >
            Work we&apos;ve already started
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8" style={{ color: g.bodyText }}>
            This isn&apos;t a plan. It&apos;s already happening. Silvan is already working, learning and
            building.
          </p>

          {/* Gallery placeholders — replace with real Buds At Work photos */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: 'First window cleaning jobs', bg: '#E8F4F0' },
              { label: 'Lawn care work', bg: '#F5F0E8' },
              { label: 'Equipment setup', bg: '#EAF0F5' },
              { label: 'Workplace training', bg: '#F5EAE8' },
              { label: 'Community activities', bg: '#E8EAF5' },
              { label: 'Jackson & Silvan working together', bg: '#EFF5E8' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex h-52 items-center justify-center rounded-2xl border text-center"
                style={{ background: item.bg, borderColor: 'rgba(0,58,52,0.08)' }}
              >
                <p className="px-6 text-sm font-bold" style={{ color: g.mutedGreen }}>
                  {item.label}
                  <br />
                  <span className="mt-1 block text-xs font-normal opacity-60">
                    Real photo to be added
                  </span>
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm" style={{ color: g.mutedGreen }}>
            Follow our journey on{' '}
            <a
              href="https://www.tiktok.com/@buds.at.work"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              TikTok
            </a>
            ,{' '}
            <a
              href="https://www.instagram.com/budsatwork_aus"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              Instagram
            </a>{' '}
            and{' '}
            <a
              href="https://www.facebook.com/people/Buds-At-Work/61579013228527/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              Facebook
            </a>
            .
          </p>
        </div>
      </section>

      {/* ── Section 5: Other Ways To Help ───────────────────────────────────── */}
      <section
        id="ways-to-help"
        className="px-4 py-20 md:px-8 md:py-28"
        style={{ background: g.soft }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="text-xs font-bold uppercase tracking-[0.18em]"
            style={{ color: g.mutedGreen }}
          >
            Other ways to help
          </p>
          <h2
            className="mt-3 text-3xl font-black leading-tight md:text-5xl"
            style={{ color: g.green }}
          >
            Join the journey
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: 'Donate Equipment',
                body: 'Donate tools, trailers, safety gear and resources. Every piece of equipment creates more job capacity.',
                cta: 'Donate Equipment',
              },
              {
                title: 'Hire Buds At Work',
                body: 'Create paid work opportunities for Silvan and future participants by booking a job.',
                cta: 'Book a Job',
                href: '/services',
              },
              {
                title: 'Partner With Us',
                body: 'Become a business employment partner. Refer work, host training or sponsor shifts.',
                cta: 'Get in Touch',
              },
              {
                title: 'Share Skills',
                body: 'Provide mentoring, training or workplace experience to help participants grow.',
                cta: 'Get Involved',
              },
            ].map((card) => (
              <article
                key={card.title}
                className="flex flex-col rounded-2xl border bg-white p-6 shadow-[0_18px_45px_rgba(0,58,52,0.08)]"
                style={{ borderColor: 'rgba(0,58,52,0.1)' }}
              >
                <h3 className="text-xl font-black" style={{ color: g.green }}>
                  {card.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-7" style={{ color: '#53675F' }}>
                  {card.body}
                </p>
                {card.href ? (
                  <Link
                    href={card.href}
                    className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: g.green, color: '#fff' }}
                  >
                    {card.cta}
                    <Arrow />
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSponsorModal(true)}
                    className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ background: g.green, color: '#fff' }}
                  >
                    {card.cta}
                    <Arrow />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 6: Final CTA ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden px-4 py-24 text-center md:px-8 md:py-32"
        style={{ background: g.green }}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-15"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: g.cream }}>
            Help create the next paid shift
          </p>
          <h2 className="mt-4 text-4xl font-black leading-tight text-white md:text-6xl">
            Help Create The Next Paid Shift
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/80">
            Every contribution helps create more opportunities for people with disabilities to build
            confidence, skills and independence through real paid work.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="#wishlist"
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-8 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,58,52,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: g.mustard, color: g.green }}
            >
              Fund A Wishlist Item
              <Arrow />
            </a>
            <button
              type="button"
              onClick={() => setShowSponsorModal(true)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 bg-white/12 px-8 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Other Ways To Help
            </button>
          </div>
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
    </div>
  );
}
