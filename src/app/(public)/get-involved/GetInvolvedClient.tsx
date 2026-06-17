'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SponsorModal from './SponsorModal';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';
import type { SocialProofItem } from '@/app/api/social-proof/route';

const g = {
  green: '#003A34',
  leaf: '#1C7C54',
  mustard: '#E7A637',
  cream: '#FAF0D9',
  soft: '#FFF9EB',
  ink: '#12261E',
  muted: '#52645D',
};

const HERO_ALT = 'Buds At Work team after a window cleaning job.';

interface Props {
  items: FundraisingItem[];
  stats: Omit<SiteImpactStats, 'id' | 'updated_at'>;
  socialItems: SocialProofItem[];
  heroImageUrl: string | null;
}

function formatAUD(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-AU', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value)
  );
}

function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm font-semibold" style={{ color: g.green }}>
        <span>{formatAUD(raised)} raised</span>
        <span className="text-xs" style={{ color: g.muted }}>
          {pct}% of {formatAUD(goal)}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#E7E0CA]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: g.mustard }} />
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  equipment: 'Equipment',
  uniforms: 'Uniforms',
  training: 'Training',
  transport: 'Transport',
  technology: 'Technology',
  general: 'General',
};

const PLATFORM_LABELS: Record<SocialProofItem['platform'], string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  facebook: 'Facebook',
};

function getEmbedUrl(item: SocialProofItem) {
  try {
    const url = new URL(item.source_url);
    if (item.platform === 'tiktok') {
      const match = url.pathname.match(/video\/(\d+)/);
      return match?.[1] ? `https://www.tiktok.com/embed/v2/${match[1]}` : null;
    }
    if (item.platform === 'instagram') {
      const match = url.pathname.match(/\/(reel|p)\/([^/]+)/);
      return match?.[2] ? `https://www.instagram.com/${match[1]}/${match[2]}/embed` : null;
    }
    if (item.platform === 'facebook') {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(item.source_url)}&show_text=false`;
    }
  } catch {
    return null;
  }
  return null;
}

function SocialVideoCard({ item, featured = false }: { item: SocialProofItem; featured?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const embedUrl = getEmbedUrl(item);

  return (
    <article
      className={`relative flex min-h-[360px] snap-center flex-col overflow-hidden rounded-[8px] border bg-white shadow-[0_18px_45px_rgba(0,58,52,0.10)] ${
        featured ? 'md:min-h-[460px]' : ''
      }`}
      style={{ borderColor: 'rgba(0,58,52,0.10)' }}
    >
      <div className="relative flex-1 bg-[#0B1F1A]">
        {loaded && embedUrl ? (
          <iframe
            src={embedUrl}
            title={item.title}
            loading="lazy"
            allow="fullscreen; clipboard-write; encrypted-media; picture-in-picture"
            className="h-full min-h-[300px] w-full border-0"
          />
        ) : (
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block h-full min-h-[300px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ outlineColor: g.mustard }}
            onClick={(event) => {
              if (!embedUrl) return;
              event.preventDefault();
              setLoaded(true);
            }}
          >
            {item.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnail_url} alt="" className="h-full min-h-[300px] w-full object-cover opacity-90 transition group-hover:scale-[1.02]" />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center bg-[radial-gradient(circle_at_35%_20%,rgba(231,166,55,0.24),transparent_34%),linear-gradient(145deg,#003A34,#0B1F1A)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#003A34] shadow-lg transition group-hover:scale-105">
                <PlayIcon />
              </span>
            </div>
          </a>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]" style={{ color: g.leaf }}>
          <span>{PLATFORM_LABELS[item.platform]}</span>
          <time dateTime={item.posted_at ?? undefined}>{formatDate(item.posted_at)}</time>
        </div>
        <h3 className="mt-3 text-lg font-black leading-tight" style={{ color: g.green }}>
          {item.title}
        </h3>
      </div>
    </article>
  );
}

export default function GetInvolvedClient({ items, stats, socialItems, heroImageUrl }: Props) {
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [donating, setDonating] = useState(false);
  const [heroMissing, setHeroMissing] = useState(false);

  const featuredSocial = socialItems.find((item) => item.is_featured) ?? socialItems[0];
  const previewSocial = socialItems.filter((item) => item.id !== featuredSocial?.id);

  async function handleDonate(amountCents: number) {
    if (donating) return;
    setDonating(true);
    try {
      const res = await fetch('/api/donate/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
      else setDonating(false);
    } catch {
      setDonating(false);
    }
  }

  function handleItemCTA(item: FundraisingItem) {
    if (item.payment_url) window.open(item.payment_url, '_blank', 'noopener,noreferrer');
    else setShowSponsorModal(true);
  }

  const impactMetrics = [
    { value: stats.participants_supported, label: 'Participants supported' },
    { value: stats.paid_jobs_completed, label: 'Paid jobs completed' },
    { value: stats.training_hours_delivered, label: 'Training hours delivered' },
    { value: stats.employment_opportunities_created, label: 'Employment opportunities created' },
  ];

  return (
    <div className="-mx-4 -mt-8 overflow-hidden bg-white md:-mx-8 md:-mt-10">
      <section className="relative isolate flex min-h-[82svh] items-end overflow-hidden px-4 pb-12 pt-32 md:px-8 md:pb-16" style={{ backgroundColor: g.green }}>
        {heroImageUrl && !heroMissing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={HERO_ALT}
            onError={() => setHeroMissing(true)}
            className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover object-center opacity-70"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,58,52,0.98) 0%, rgba(0,58,52,0.88) 48%, rgba(0,58,52,0.55) 100%), linear-gradient(0deg, rgba(0,58,52,0.98) 0%, rgba(0,58,52,0.10) 64%)',
          }}
        />

        <div className="mx-auto w-full max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: g.cream }}>
              Buds At Work - Logan & South Brisbane
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[0.96] text-white md:text-7xl lg:text-8xl">
              Help Create The Next Paid Shift
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/86 md:text-xl">
              Buds At Work creates practical paid work opportunities for people with disabilities through local jobs, training, equipment and support.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#wishlist" className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: g.mustard, color: g.green }}>
                Fund The Next Shift
                <Arrow />
              </a>
              <a href="#wishlist" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 bg-white/12 px-7 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                See What We Need
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8" style={{ background: g.soft }}>
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {impactMetrics.map((metric) => (
            <div key={metric.label} className="rounded-[8px] border bg-white p-5" style={{ borderColor: 'rgba(0,58,52,0.10)' }}>
              <div className="text-4xl font-black leading-none" style={{ color: g.green }}>
                {metric.value != null ? metric.value.toLocaleString() : '-'}
              </div>
              <div className="mt-2 text-xs font-bold uppercase leading-5 tracking-[0.12em]" style={{ color: g.muted }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20 md:px-8 md:py-24" style={{ background: g.soft }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: g.leaf }}>
              Building Real Paid Work Pathways
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl" style={{ color: g.green }}>
              Local work that builds skills, income and confidence.
            </h2>
          </div>
          <div className="space-y-5 text-lg leading-8" style={{ color: g.muted }}>
            <p>
              Buds At Work is building accessible paid work pathways around real community jobs: window cleaning, lawn care, support tasks, equipment handling and workplace routines.
            </p>
            <p>
              Silvan is one of the first people being supported. The bigger goal is a repeatable pathway where more people with disabilities can learn, earn and contribute through practical local work.
            </p>
            <p className="font-bold" style={{ color: g.green }}>
              You&apos;re not funding equipment — you&apos;re funding opportunity.
            </p>
          </div>
        </div>
      </section>

      <section id="wishlist" className="px-4 py-20 md:px-8 md:py-28" style={{ background: g.green }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: g.cream }}>
            What We&apos;re Raising Money For
          </p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-white md:text-5xl">
            Fund the practical pieces that make paid shifts possible.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-white/75">
            Every card is framed around employment outcomes: safer work, more training, better transport, and more paid job capacity.
          </p>

          {items.length === 0 ? (
            <div className="mt-12 rounded-[8px] border border-white/20 bg-white/10 p-10 text-center backdrop-blur-sm">
              <p className="text-lg text-white/78">
                New wishlist items are being prepared. Check back soon, or{' '}
                <a href="mailto:hello@budsatwork.com" className="font-bold text-white underline">
                  contact us
                </a>{' '}
                to help directly.
              </p>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="flex flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_22px_60px_rgba(0,0,0,0.16)]">
                  {item.image_url ? (
                    <div className="relative h-48 overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center" style={{ background: '#F5E5BF' }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: g.muted }}>
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <span className="inline-block w-fit rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]" style={{ background: '#F5E5BF', color: g.green }}>
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <h3 className="mt-4 text-xl font-black leading-tight" style={{ color: g.green }}>
                      {item.title}
                    </h3>
                    {item.short_reason && <p className="mt-3 flex-1 text-sm leading-7" style={{ color: g.muted }}>{item.short_reason}</p>}
                    {item.who_it_helps && <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: g.leaf }}>Helps: {item.who_it_helps}</p>}
                    {item.employment_impact && <p className="mt-2 text-sm font-semibold leading-6" style={{ color: g.green }}>{item.employment_impact}</p>}
                    {item.goal_amount_cents > 0 && (
                      <div className="mt-5">
                        <ProgressBar raised={item.raised_amount_cents} goal={item.goal_amount_cents} />
                      </div>
                    )}
                    <button type="button" onClick={() => handleItemCTA(item)} className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: g.green, color: '#fff' }}>
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

      <section className="px-4 py-20 md:px-8 md:py-28" style={{ background: '#fff' }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: g.leaf }}>
            Real Work. Real Progress.
          </p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-black leading-tight md:text-5xl" style={{ color: g.green }}>
                Every job, lesson and milestone is shared as it happens.
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8" style={{ color: g.muted }}>
                Follow the real work through Buds At Work videos, reels and short-form updates from the job.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm font-bold" style={{ color: g.green }}>
              <a href="https://www.tiktok.com/@buds.at.work" target="_blank" rel="noopener noreferrer" className="rounded-full border px-4 py-2 hover:bg-[#F1F7F3]">TikTok</a>
              <a href="https://www.instagram.com/budsatwork_aus" target="_blank" rel="noopener noreferrer" className="rounded-full border px-4 py-2 hover:bg-[#F1F7F3]">Instagram</a>
              <a href="https://www.facebook.com/people/Buds-At-Work/61579013228527/" target="_blank" rel="noopener noreferrer" className="rounded-full border px-4 py-2 hover:bg-[#F1F7F3]">Facebook</a>
            </div>
          </div>

          {socialItems.length === 0 ? (
            <div className="mt-10 rounded-[8px] border p-8" style={{ borderColor: 'rgba(0,58,52,0.12)', background: g.soft }}>
              <p className="text-base leading-7" style={{ color: g.muted }}>
                New videos are being selected for this page. Follow Buds At Work on TikTok, Instagram or Facebook for the latest updates.
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              {featuredSocial && <SocialVideoCard item={featuredSocial} featured />}
              <div className="flex snap-x gap-5 overflow-x-auto pb-3 lg:grid lg:grid-cols-1 lg:overflow-visible lg:pb-0">
                {previewSocial.length > 0 ? previewSocial.map((item) => (
                  <div key={item.id} className="min-w-[82vw] sm:min-w-[360px] lg:min-w-0">
                    <SocialVideoCard item={item} />
                  </div>
                )) : (
                  <div className="rounded-[8px] border p-6 text-sm leading-6" style={{ borderColor: 'rgba(0,58,52,0.12)', color: g.muted }}>
                    Add more featured videos in the fundraising admin area to fill the carousel.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="ways-to-help" className="px-4 py-20 md:px-8 md:py-28" style={{ background: g.soft }}>
        <div className="mx-auto max-w-6xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: g.leaf }}>
            Other Ways To Help
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight md:text-5xl" style={{ color: g.green }}>
            Support the pathway around the paid work.
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Donate Equipment', body: 'Donate tools, safety gear or supplies that increase job capacity.', cta: 'Donate Equipment' },
              { title: 'Hire Buds At Work', body: 'Book local work and create practical paid shifts in the community.', cta: 'Book a Job', href: '/services' },
              { title: 'Partner With Us', body: 'Refer work, host training, sponsor shifts or open a pathway.', cta: 'Get in Touch' },
              { title: 'Share Skills', body: 'Provide mentoring, training or workplace experience for participants.', cta: 'Get Involved' },
            ].map((card) => (
              <article key={card.title} className="flex flex-col rounded-[8px] border bg-white p-6 shadow-[0_18px_45px_rgba(0,58,52,0.08)]" style={{ borderColor: 'rgba(0,58,52,0.1)' }}>
                <h3 className="text-xl font-black" style={{ color: g.green }}>{card.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-7" style={{ color: g.muted }}>{card.body}</p>
                {card.href ? (
                  <Link href={card.href} className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: g.green, color: '#fff' }}>
                    {card.cta}
                    <Arrow />
                  </Link>
                ) : (
                  <button type="button" onClick={() => setShowSponsorModal(true)} className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: g.green, color: '#fff' }}>
                    {card.cta}
                    <Arrow />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24 text-center md:px-8 md:py-32" style={{ background: g.green }}>
        {heroImageUrl && !heroMissing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-15" />
        )}
        <div className="relative mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: g.cream }}>
            Help create the next paid shift
          </p>
          <h2 className="mt-4 text-4xl font-black leading-tight text-white md:text-6xl">
            Practical support turns into real paid work.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/80">
            Contributions help Buds At Work create more accessible opportunities for people with disabilities to learn, earn and build confidence through local jobs.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="#wishlist" className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-8 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: g.mustard, color: g.green }}>
              Fund A Wishlist Item
              <Arrow />
            </a>
            <button type="button" onClick={() => handleDonate(5000)} disabled={donating} className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 bg-white/12 px-8 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Donate $50
            </button>
          </div>
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
    </div>
  );
}
