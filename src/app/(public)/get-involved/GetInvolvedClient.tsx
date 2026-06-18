'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SponsorModal from './SponsorModal';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';
import type { SocialProofItem } from '@/app/api/social-proof/route';

const c = {
  green: '#003A34',
  forest: '#082C25',
  leaf: '#1C7C54',
  mint: '#DDF0E6',
  mustard: '#E7A637',
  paper: '#FFF9EB',
  cream: '#FAF0D9',
  ink: '#12261E',
  muted: '#52645D',
  line: 'rgba(0,58,52,0.14)',
};

const HERO_ALT = 'Jackson and Silvan after a Buds At Work window cleaning job.';

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
  if (!value) return 'Recent update';
  return new Intl.DateTimeFormat('en-AU', { month: 'short', day: 'numeric', year: 'numeric' }).format(
    new Date(value)
  );
}

function Arrow({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className={className} aria-hidden="true">
      <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} className="h-4 w-4" aria-hidden="true">
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
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

function PlatformIcon({ platform, className = 'h-4 w-4' }: { platform: 'tiktok' | 'instagram' | 'facebook'; className?: string }) {
  if (platform === 'tiktok') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34l-.01-8.45a8.14 8.14 0 0 0 4.78 1.55V5.02a4.85 4.85 0 0 1-1-.33z" />
      </svg>
    );
  }
  if (platform === 'instagram') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function ActionIcon({ type }: { type: 'hire' | 'equipment' | 'training' | 'experience' | 'shift' }) {
  const paths: Record<typeof type, React.ReactNode> = {
    hire: <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Zm4 0V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M8 13h8" />,
    equipment: <path d="M6 19V8l6-4 6 4v11M9 19v-7h6v7M4 19h16" />,
    training: <path d="M4 7l8-4 8 4-8 4-8-4Zm3 4v4c0 1.7 2.2 3 5 3s5-1.3 5-3v-4" />,
    experience: <path d="M7 20V6a2 2 0 0 1 2-2h9v16M4 20h17M11 9h3M11 13h3" />,
    shift: <path d="M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-6 w-6" aria-hidden="true">
      {paths[type]}
    </svg>
  );
}

const AMOUNT_PRESETS = [
  { label: '$20', cents: 2000 },
  { label: '$50', cents: 5000 },
  { label: '$100', cents: 10000 },
];

function FundraisingCard({ item }: { item: FundraisingItem }) {
  const [picking, setPicking] = useState(false);
  const defaultCents = (() => {
    const rem = item.goal_amount_cents - item.raised_amount_cents;
    if (rem > 0 && rem <= 500_000) return Math.min(rem, 10000);
    return 5000;
  })();
  const [selectedCents, setSelectedCents] = useState<number | null>(defaultCents);
  const [isCustom, setIsCustom] = useState(false);
  const [customStr, setCustomStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const customCents = (() => {
    const val = parseFloat(customStr);
    return Number.isFinite(val) && val >= 5 ? Math.round(val * 100) : null;
  })();

  const contributionCents = isCustom ? customCents : selectedCents;
  const isValid = contributionCents !== null && contributionCents >= 500;
  const remainingCents = Math.max(0, item.goal_amount_cents - item.raised_amount_cents);

  function selectPreset(cents: number) {
    setIsCustom(false);
    setSelectedCents(cents);
    setErr(null);
  }

  function selectCustom() {
    setIsCustom(true);
    setSelectedCents(null);
    setErr(null);
  }

  function cancel() {
    setPicking(false);
    setErr(null);
  }

  async function handleContribute() {
    if (!isValid || !contributionCents || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/fundraising/${item.id}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: contributionCents }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return; // stay loading while navigating
      }
      // API failed — try stored payment_url as last resort
      if (item.payment_url) {
        window.open(item.payment_url, '_blank', 'noopener,noreferrer');
        setLoading(false);
        return;
      }
      setErr(data.error ?? 'Payment unavailable. Please try again.');
    } catch {
      if (item.payment_url) {
        window.open(item.payment_url, '_blank', 'noopener,noreferrer');
      } else {
        setErr('Payment unavailable. Please try again.');
      }
    }
    setLoading(false);
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[8px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
      {item.image_url ? (
        <div className="relative h-56 overflow-hidden bg-[#0B1F1A]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image_url} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          <span className="absolute left-4 top-4 rounded-full bg-white/92 px-3 py-1 text-xs font-black uppercase tracking-[0.12em]" style={{ color: c.green }}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center" style={{ background: c.cream }}>
          <span className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: c.green }}>
            {CATEGORY_LABELS[item.category] ?? item.category}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-2xl font-black leading-tight" style={{ color: c.green }}>
            {item.title}
          </h3>
          {item.goal_amount_cents > 0 && (
            <span className="shrink-0 text-sm font-black" style={{ color: c.leaf }}>
              {formatAUD(item.goal_amount_cents)}
            </span>
          )}
        </div>

        {item.short_reason && (
          <p className="mt-4 text-sm leading-7" style={{ color: c.muted }}>{item.short_reason}</p>
        )}

        <div className="mt-5 border-l-2 pl-4" style={{ borderColor: c.mustard }}>
          <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: c.leaf }}>How this creates paid work</p>
          <p className="mt-2 text-sm font-bold leading-6" style={{ color: c.green }}>
            {item.employment_impact || 'This helps Buds At Work turn community demand into practical paid shifts with the right equipment, training and support.'}
          </p>
        </div>

        {item.who_it_helps && (
          <p className="mt-4 text-xs font-black uppercase tracking-[0.08em]" style={{ color: c.muted }}>
            Supports: {item.who_it_helps}
          </p>
        )}

        {item.goal_amount_cents > 0 && (
          <div className="mt-5">
            <ProgressBar raised={item.raised_amount_cents} goal={item.goal_amount_cents} />
            {(item.contribution_count ?? 0) > 0 && (
              <p className="mt-2 text-xs font-bold" style={{ color: c.muted }}>
                {item.contribution_count} {item.contribution_count === 1 ? 'person has' : 'people have'} contributed
              </p>
            )}
          </div>
        )}

        {/* ── Amount picker / CTA ──────────────────────────────────── */}
        {item.is_funded ? (
          <div
            className="mt-6 rounded-[8px] border-2 py-4 text-center"
            style={{ borderColor: c.leaf, background: c.mint }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: c.leaf }}>✦ Fully Funded ✦</p>
            <p className="mt-1 text-sm font-bold" style={{ color: c.green }}>Thank you to everyone who contributed.</p>
          </div>
        ) : picking ? (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.12em]" style={{ color: c.muted }}>
              Choose amount
            </p>
            <div className="grid grid-cols-4 gap-2">
              {AMOUNT_PRESETS.map(({ label, cents }) => {
                const active = !isCustom && selectedCents === cents;
                return (
                  <button
                    key={cents}
                    type="button"
                    onClick={() => selectPreset(cents)}
                    className="rounded-full border py-2.5 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{
                      background: active ? c.green : 'transparent',
                      color: active ? '#fff' : c.green,
                      borderColor: c.green,
                    }}
                  >
                    {label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={selectCustom}
                className="rounded-full border py-2.5 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{
                  background: isCustom ? c.green : 'transparent',
                  color: isCustom ? '#fff' : c.green,
                  borderColor: c.green,
                }}
              >
                Custom
              </button>
            </div>

            {isCustom && (
              <div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: c.muted }}>$</span>
                  <input
                    type="number"
                    min={5}
                    step="any"
                    value={customStr}
                    onChange={(e) => { setCustomStr(e.target.value); setErr(null); }}
                    placeholder="Amount"
                    className="w-full rounded-xl border py-3 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#003A34]"
                    style={{ borderColor: c.line }}
                      autoFocus
                  />
                </div>
                <p className="mt-1 text-xs" style={{ color: c.muted }}>Minimum $5</p>
              </div>
            )}

            {isValid && contributionCents && remainingCents > 0 && (
              <p className="text-xs font-bold text-center" style={{ color: c.leaf }}>
                You&apos;d be funding {Math.min(100, Math.round((contributionCents / remainingCents) * 100))}% of the remaining goal
              </p>
            )}

            {err && <p className="text-xs font-bold text-red-600">{err}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancel}
                className="flex-1 rounded-full border py-3 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ borderColor: c.line, color: c.muted }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleContribute}
                disabled={!isValid || loading}
                className="flex-[2] min-h-[46px] rounded-full py-3 text-sm font-black transition-transform hover:-translate-y-0.5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: c.green, color: '#fff' }}
              >
                {loading
                  ? 'Redirecting…'
                  : `Contribute${isValid && contributionCents ? ` ${formatAUD(contributionCents)}` : ''}`}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {item.goal_amount_cents > 0 && remainingCents > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold" style={{ color: c.mustard }}>
                  {formatAUD(remainingCents)} still needed
                </p>
                {Math.round((item.raised_amount_cents / item.goal_amount_cents) * 100) >= 70 && (
                  <span className="rounded-full px-2 py-0.5 text-xs font-black uppercase tracking-[0.1em]" style={{ background: c.mustard, color: c.green }}>
                    Almost there!
                  </span>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: c.green, color: '#fff' }}
            >
              {item.cta_label || 'Help Fund This'}
              <Arrow />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function ProgressBar({ raised, goal }: { raised: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  const remaining = Math.max(0, goal - raised);
  const funded = goal > 0 && raised >= goal;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm font-black" style={{ color: c.green }}>
        <span>{raised === 0 ? '$0 raised so far' : funded ? 'Funded' : `${formatAUD(raised)} raised`}</span>
        <span className="text-xs" style={{ color: c.muted }}>
          {pct}% of {formatAUD(goal)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E7E0CA]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.mustard }} />
      </div>
      <p className="mt-2 text-xs font-black uppercase tracking-[0.08em]" style={{ color: c.muted }}>
        {funded ? 'Fully funded' : `${formatAUD(remaining)} remaining`}
      </p>
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

function SocialCard({ item }: { item: SocialProofItem }) {
  const [embedState, setEmbedState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const embedUrl = getEmbedUrl(item);

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-xl border bg-white shadow-[0_4px_24px_rgba(0,58,52,0.09)] transition-shadow hover:shadow-[0_8px_32px_rgba(0,58,52,0.14)]"
      style={{ borderColor: c.line }}
    >
      {/* Media — locked to portrait 9:16 */}
      <div className="relative aspect-[9/16] overflow-hidden bg-[#071A16]">

        {/* Skeleton shimmer while iframe initialises */}
        {embedState === 'loading' && (
          <div
            className="absolute inset-0 z-10 animate-pulse"
            style={{ background: 'linear-gradient(135deg, #0B2A22 0%, #0d3328 100%)' }}
          />
        )}

        {/* Iframe — rendered only after user triggers play */}
        {embedState !== 'idle' && embedUrl && (
          <iframe
            src={embedUrl}
            title={item.title}
            loading="lazy"
            allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
            onLoad={() => setEmbedState('ready')}
            className="absolute inset-0 h-full w-full border-0"
          />
        )}

        {/* Thumbnail / play trigger — visible until embed loads */}
        {embedState === 'idle' && (
          embedUrl ? (
            <button
              type="button"
              onClick={() => setEmbedState('loading')}
              className="absolute inset-0 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E7A637]"
              aria-label={`Play: ${item.title}`}
            >
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-3"
                  style={{ background: `linear-gradient(160deg, ${c.forest} 0%, ${c.green} 100%)` }}
                >
                  <PlatformIcon platform={item.platform} className="h-10 w-10 text-white/25" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-[#003A34] shadow-xl backdrop-blur-sm transition duration-200 group-hover:scale-110 group-hover:bg-white">
                  <PlayIcon />
                </span>
              </span>
            </button>
          ) : (
            /* No embeddable URL — link directly to platform */
            <a
              href={item.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E7A637]"
            >
              {item.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <div
                  className="flex h-full w-full flex-col items-center justify-center gap-3"
                  style={{ background: `linear-gradient(160deg, ${c.forest} 0%, ${c.green} 100%)` }}
                >
                  <PlatformIcon platform={item.platform} className="h-10 w-10 text-white/25" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/15 px-4 py-1.5 text-xs font-black text-white backdrop-blur-sm">
                Watch on {PLATFORM_LABELS[item.platform]} ↗
              </span>
            </a>
          )
        )}

        {/* Platform badge */}
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 backdrop-blur-sm">
          <PlatformIcon platform={item.platform} className="h-3 w-3 text-white" />
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white">
            {PLATFORM_LABELS[item.platform]}
          </span>
        </div>
      </div>

      {/* Card footer */}
      <div className="flex flex-col p-4">
        <h3 className="line-clamp-2 text-sm font-black leading-snug" style={{ color: c.green }}>
          {item.title}
        </h3>
        <div className="mt-3 flex items-center justify-between">
          <time className="text-xs font-bold" style={{ color: c.muted }} dateTime={item.posted_at ?? undefined}>
            {formatDate(item.posted_at)}
          </time>
          <a
            href={item.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-black transition-opacity hover:opacity-70"
            style={{ color: c.leaf }}
          >
            View ↗
          </a>
        </div>
      </div>
    </article>
  );
}

function SocialFeed({ items }: { items: SocialProofItem[] }) {
  return (
    /* -mx-4/px-4 lets the carousel bleed to viewport edges on mobile */
    <div className="mt-10 -mx-4 px-4 md:mx-0 md:px-0">
      <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="w-[68vw] max-w-[260px] shrink-0 snap-start md:w-auto md:max-w-none"
          >
            <SocialCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionIntro({
  eyebrow,
  title,
  body,
  light = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  light?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: light ? c.cream : c.leaf }}>
        {eyebrow}
      </p>
      <h2 className={`mt-3 text-3xl font-black leading-tight md:text-5xl ${light ? 'text-white' : ''}`} style={light ? undefined : { color: c.green }}>
        {title}
      </h2>
      {body && (
        <p className={`mt-4 max-w-2xl text-lg leading-8 ${light ? 'text-white/76' : ''}`} style={light ? undefined : { color: c.muted }}>
          {body}
        </p>
      )}
    </div>
  );
}

function EmptySocialFallback() {
  return (
    <div className="mt-10 flex flex-col gap-4 border-y py-8 md:flex-row md:items-center md:justify-between" style={{ borderColor: c.line }}>
      <p className="max-w-xl text-base leading-7" style={{ color: c.muted }}>
        Follow the latest job updates directly on Buds At Work social channels while new featured videos are selected.
      </p>
      <SocialLinks />
    </div>
  );
}

const SOCIAL_CHANNELS = [
  { label: 'TikTok', platform: 'tiktok' as const, href: 'https://www.tiktok.com/@buds.at.work' },
  { label: 'Instagram', platform: 'instagram' as const, href: 'https://www.instagram.com/budsatwork_aus' },
  { label: 'Facebook', platform: 'facebook' as const, href: 'https://www.facebook.com/people/Buds-At-Work/61579013228527/' },
];

function SocialLinks() {
  return (
    <div className="flex flex-wrap gap-2">
      {SOCIAL_CHANNELS.map((ch) => (
        <a
          key={ch.platform}
          href={ch.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black transition hover:bg-[#F1F7F3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ borderColor: c.line, color: c.green }}
        >
          <PlatformIcon platform={ch.platform} className="h-3.5 w-3.5" />
          {ch.label}
        </a>
      ))}
    </div>
  );
}

function Milestone({
  status,
  title,
  detail,
  value,
}: {
  status: 'done' | 'current' | 'next';
  title: string;
  detail: string;
  value?: number;
}) {
  const isDone = status === 'done';
  const isCurrent = status === 'current';

  return (
    <li className="relative flex gap-4 pb-8 last:pb-0">
      <span className="absolute left-[17px] top-9 h-full w-px bg-[#D8E4DA] last:hidden" aria-hidden="true" />
      <span
        className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-black"
        style={{
          background: isDone ? c.green : isCurrent ? c.mustard : '#fff',
          borderColor: isDone || isCurrent ? 'transparent' : c.line,
          color: isDone || isCurrent ? '#fff' : c.green,
        }}
      >
        {isDone ? <CheckIcon /> : isCurrent ? '→' : '•'}
      </span>
      <div className="pt-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-lg font-black leading-tight" style={{ color: c.green }}>{title}</h3>
          {typeof value === 'number' && (
            <span className="text-sm font-black" style={{ color: c.leaf }}>
              {value.toLocaleString()}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm leading-6" style={{ color: c.muted }}>{detail}</p>
      </div>
    </li>
  );
}

export default function GetInvolvedClient({ items, stats, socialItems, heroImageUrl }: Props) {
  const [showSponsorModal, setShowSponsorModal] = useState(false);
  const [donating, setDonating] = useState(false);
  const [heroMissing, setHeroMissing] = useState(false);

  const featuredItems = [...items].sort((a, b) => Number(b.is_featured) - Number(a.is_featured));

  async function handleDonate(amountCents: number) {
    if (donating) return;
    setDonating(true);
    try {
      // Route through the fundraising item checkout when items exist so the
      // payment is attributed to the featured item and updates the progress bar.
      const featuredItem = featuredItems[0];
      const endpoint = featuredItem
        ? `/api/fundraising/${featuredItem.id}/checkout`
        : '/api/donate/checkout';
      const res = await fetch(endpoint, {
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

  const nextJobsTarget = 10;
  const currentPaidJobs = stats.paid_jobs_completed ?? 0;
  const remainingJobs = Math.max(0, nextJobsTarget - currentPaidJobs);

  const otherWays = [
    {
      icon: 'hire' as const,
      title: 'Hire Buds At Work',
      body: 'Book window cleaning, lawn care, cleaning or property work and turn a real local job into a paid shift.',
      cta: 'Book A Job',
      href: '/services',
    },
    {
      icon: 'equipment' as const,
      title: 'Donate Equipment',
      body: 'Contribute tools, safety gear, cleaning supplies or transport support that increases job capacity.',
      cta: 'Offer Equipment',
    },
    {
      icon: 'training' as const,
      title: 'Become A Training Partner',
      body: 'Share practical skills, safety routines or workplace knowledge that helps participants grow on the job.',
      cta: 'Partner With Us',
    },
    {
      icon: 'experience' as const,
      title: 'Offer Workplace Experience',
      body: 'Open a structured, supported environment where people can learn routines and build confidence.',
      cta: 'Start A Conversation',
    },
    {
      icon: 'shift' as const,
      title: 'Sponsor A Shift',
      body: 'Fund a practical work opportunity that covers resources, supervision and the support around the job.',
      cta: 'Sponsor A Shift',
    },
  ];

  return (
    <div className="-mx-4 -mt-8 overflow-hidden bg-white md:-mx-8 md:-mt-10">
      <section className="relative isolate min-h-[88svh] overflow-hidden px-4 pb-10 pt-28 md:px-8 md:pb-14 md:pt-36" style={{ backgroundColor: c.green }}>
        {heroImageUrl && !heroMissing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImageUrl}
            alt={HERO_ALT}
            onError={() => setHeroMissing(true)}
            className="absolute inset-0 -z-20 h-full w-full scale-[1.02] object-cover object-[58%_center] opacity-80 md:object-center"
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(90deg, rgba(0,58,52,0.98) 0%, rgba(0,58,52,0.90) 45%, rgba(0,58,52,0.35) 100%), linear-gradient(0deg, rgba(0,58,52,1) 0%, rgba(0,58,52,0.08) 60%)',
          }}
        />

        <div className="mx-auto flex min-h-[calc(88svh-9rem)] w-full max-w-6xl flex-col justify-end">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: c.cream }}>
              Creating Real Paid Work Opportunities
            </p>
            <h1 className="mt-4 text-5xl font-black leading-[0.96] text-white md:text-7xl lg:text-8xl">
              From First Shift To First Career
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/88 md:text-xl">
              Buds At Work helps people with disabilities build confidence, skills and income through real local jobs across Logan and South Brisbane.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#wishlist" className="inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: c.mustard, color: c.green }}>
                Support The Next Opportunity
                <Arrow />
              </a>
              <a href="#meet-silvan" className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-white/50 bg-white/12 px-7 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                Meet Silvan
              </a>
            </div>
          </div>

          {items.length > 0 && (() => {
            const sumGoal = items.reduce((acc, it) => acc + it.goal_amount_cents, 0);
            const sumRaised = items.reduce((acc, it) => acc + it.raised_amount_cents, 0);
            if (sumGoal <= 0) return null;
            const overallPct = Math.round((sumRaised / sumGoal) * 100);
            return (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/12 px-5 py-2.5 backdrop-blur-sm">
                <span className="text-sm font-black text-white">
                  {overallPct >= 100
                    ? 'Wishlist fully funded — thank you!'
                    : `✦  ${overallPct}% of our current wishlist is funded — help us reach 100%`}
                </span>
              </div>
            );
          })()}

          <div className="mt-12 grid gap-3 border-t border-white/20 pt-5 text-white sm:grid-cols-3">
            <div>
              <p className="text-3xl font-black">{(stats.participants_supported ?? 0).toLocaleString()}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/68">Participant supported</p>
            </div>
            <div>
              <p className="text-3xl font-black">{currentPaidJobs.toLocaleString()}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/68">Paid jobs completed</p>
            </div>
            <div>
              <p className="text-3xl font-black">{remainingJobs}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-white/68">Jobs to next milestone</p>
            </div>
          </div>
        </div>
      </section>

      <section id="meet-silvan" className="px-4 py-18 md:px-8 md:py-24" style={{ background: c.paper }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div className="relative overflow-hidden rounded-[8px] bg-[#0B1F1A] shadow-[0_30px_80px_rgba(0,58,52,0.18)]">
            {heroImageUrl && !heroMissing ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={heroImageUrl} alt={HERO_ALT} className="aspect-[4/5] w-full object-cover object-[70%_center] md:aspect-[5/6]" />
            ) : (
              <div className="aspect-[4/5] w-full" style={{ background: c.green }} />
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
              <p className="text-sm font-bold leading-6 text-white/90">A real window cleaning job, a real customer, and a real paid work pathway beginning to form.</p>
            </div>
          </div>
          <div>
            <SectionIntro
              eyebrow="Meet Silvan"
              title="The work starts with one person, one shift and one practical win at a time."
              body="Silvan is one of the first people being supported through Buds At Work. He is building confidence through hands-on routines, clear expectations and paid jobs that happen in the community."
            />
            <div className="mt-8 grid gap-4 border-y py-6 sm:grid-cols-2" style={{ borderColor: c.line }}>
              <p className="text-base leading-7" style={{ color: c.muted }}>
                The goal is not a token activity. It is useful work with real standards: turning up, learning the task, using the tools safely and finishing a job someone values.
              </p>
              <p className="text-base leading-7" style={{ color: c.muted }}>
                Every piece of support helps create the environment around that work: equipment, training, supervision, transport and the next customer opportunity.
              </p>
            </div>
            <p className="mt-6 text-xl font-black leading-8" style={{ color: c.green }}>
              This is how a first shift can become the start of a first career.
            </p>
          </div>
        </div>
      </section>

      {[stats.participants_supported, stats.paid_jobs_completed, stats.employment_opportunities_created].some(v => (v ?? 0) > 0) && (
        <section className="px-4 py-18 md:px-8 md:py-24" style={{ background: c.green }}>
          <div className="mx-auto max-w-6xl">
            <SectionIntro eyebrow="Impact So Far" title="Real work. Real outcomes." light />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'Participant Supported', value: stats.participants_supported ?? 0 },
                { label: 'Paid Jobs Completed', value: stats.paid_jobs_completed ?? 0 },
                { label: 'Equipment Purchased', value: stats.employment_opportunities_created ?? 0 },
              ].filter(s => s.value > 0).map(s => (
                <div key={s.label} className="rounded-[8px] bg-white/10 p-6 text-center">
                  <p className="text-4xl font-black text-white">{s.value.toLocaleString()}</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-4 py-18 md:px-8 md:py-24" style={{ background: '#fff' }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionIntro
            eyebrow="Progress So Far"
            title="A pathway is being built in public."
            body="The numbers matter because they represent visible movement: first support, first jobs, first tools and the next milestone."
          />
          <ol className="rounded-[8px] border bg-white p-6 shadow-[0_20px_60px_rgba(0,58,52,0.08)] md:p-8" style={{ borderColor: c.line }}>
            <Milestone
              status={(stats.participants_supported ?? 0) > 0 ? 'done' : 'current'}
              title="First participant supported"
              detail="Silvan is being supported through practical work routines and real job expectations."
              value={stats.participants_supported}
            />
            <Milestone
              status={currentPaidJobs > 0 ? 'done' : 'current'}
              title="First paid jobs completed"
              detail="Window cleaning and local service jobs are turning community demand into paid shifts."
              value={currentPaidJobs}
            />
            <Milestone
              status={(stats.employment_opportunities_created ?? 0) > 0 ? 'done' : 'current'}
              title="Equipment purchased and opportunities created"
              detail="Tools and supplies are being added as the work expands into more service types."
              value={stats.employment_opportunities_created}
            />
            <Milestone
              status="next"
              title="Next milestone: 10 paid jobs"
              detail="The next target is proving repeatable work, repeatable training and repeatable customer value."
              value={nextJobsTarget}
            />
          </ol>
        </div>
      </section>

      <section className="px-4 py-18 md:px-8 md:py-24" style={{ background: c.paper }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <SectionIntro
              eyebrow="Real Work. Real Progress."
              title="Watch the journey as it happens."
              body="The social feed brings the work closer: jobs, training, customer moments and the everyday progress behind the pathway."
            />
            <SocialLinks />
          </div>

          {socialItems.length === 0 ? (
            <EmptySocialFallback />
          ) : (
            <SocialFeed items={socialItems} />
          )}
        </div>
      </section>

      <section id="wishlist" className="px-4 py-18 md:px-8 md:py-28" style={{ background: c.green }}>
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Opportunities To Fund"
            title="Fund the practical pieces that create more paid work."
            body="Each wishlist item is connected to a work outcome: safer jobs, better training, larger service capacity or more shifts."
            light
          />

          {featuredItems.length === 0 ? (
            <div className="mt-10 border-y border-white/20 py-8">
              <p className="max-w-2xl text-lg leading-8 text-white/78">
                The next funding needs are being prepared. You can still support the work directly or start a conversation about equipment, jobs and training.
              </p>
              <button type="button" onClick={() => setShowSponsorModal(true)} className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-full px-7 py-3 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: c.mustard, color: c.green }}>
                Start A Conversation
                <Arrow />
              </button>
            </div>
          ) : (
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredItems.map((item) => (
                <FundraisingCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="px-4 py-18 md:px-8 md:py-24" style={{ background: '#fff' }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <SectionIntro
            eyebrow="Why We Started"
            title="Many people want paid work. The opportunity is the missing piece."
            body="Buds At Work was created to bridge that gap through practical jobs, community support and real employment pathways."
          />
          <div className="space-y-5 text-lg leading-8" style={{ color: c.muted }}>
            <p>
              Buds At Work is not a charity. It is a practical employment pathway built around useful services local customers already need.
            </p>
            <p>
              Window cleaning, lawn mowing, property maintenance, cleaning and community work can become structured opportunities where people learn, earn and contribute.
            </p>
            <p className="font-black" style={{ color: c.green }}>
              The support around the job is what makes the work possible.
            </p>
          </div>
        </div>
      </section>

      <section id="ways-to-help" className="px-4 py-18 md:px-8 md:py-24" style={{ background: c.paper }}>
        <div className="mx-auto max-w-6xl">
          <SectionIntro
            eyebrow="Other Ways To Help"
            title="Support the pathway from more than one angle."
            body="The strongest support is often practical: work to do, tools to use, people to learn from and shifts worth showing up for."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {otherWays.map((card) => (
              <article key={card.title} className="flex min-h-[280px] flex-col rounded-[8px] border bg-white p-5 shadow-[0_18px_45px_rgba(0,58,52,0.08)]" style={{ borderColor: c.line }}>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: c.mint, color: c.green }}>
                  <ActionIcon type={card.icon} />
                </div>
                <h3 className="mt-5 text-lg font-black leading-tight" style={{ color: c.green }}>{card.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-6" style={{ color: c.muted }}>{card.body}</p>
                {card.href ? (
                  <Link href={card.href} className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: c.green, color: '#fff' }}>
                    {card.cta}
                    <Arrow />
                  </Link>
                ) : (
                  <button type="button" onClick={() => setShowSponsorModal(true)} className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: c.green, color: '#fff' }}>
                    {card.cta}
                    <Arrow />
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-4 py-24 md:px-8 md:py-32" style={{ background: c.forest }}>
        {heroImageUrl && !heroMissing && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-18" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#082C25] via-[#082C25]/92 to-[#082C25]/70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: c.cream }}>
              Help Create The Next Opportunity
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-black leading-tight text-white md:text-6xl">
              Every contribution helps create more practical paid work opportunities.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">
              Support the equipment, training and resources that let people build confidence, skills and income through real local jobs.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <a href="#wishlist" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-black shadow-[0_18px_36px_rgba(0,0,0,0.22)] transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ background: c.mustard, color: c.green }}>
              Support A Wishlist Item
              <Arrow />
            </a>
            <Link href="/services" className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/50 bg-white/12 px-8 py-3 text-sm font-black text-white backdrop-blur-sm transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Book A Job
              <Arrow />
            </Link>
            <button type="button" onClick={() => handleDonate(5000)} disabled={donating} className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/35 px-8 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              Support $50
            </button>
          </div>
        </div>
      </section>

      <SponsorModal open={showSponsorModal} onClose={() => setShowSponsorModal(false)} />
    </div>
  );
}
