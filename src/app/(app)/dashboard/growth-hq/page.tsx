'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WorkbenchHeader } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';

// ── Types ────────────────────────────────────────────────────────────────────

interface Chapter {
  id: string;
  title: string;
  summary: string;
  goal: string;
  started_at: string | null;
}

interface Opportunity {
  id: string;
  title: string;
  content_angle: string;
  suggested_format: string;
  suggested_platform: string;
  story_score: number | null;
  section: string;
}

interface Pipeline {
  ideas: number;
  scripts: number;
  production: number;
  queue: number;
}

interface Campaign {
  id: string;
  name: string;
  goal: string;
  channels: string[];
  start_date: string | null;
  end_date: string | null;
}

interface LeadPulse {
  new: number;
  hot: number;
  awaitingResponse: number;
}

interface Trend {
  id: string;
  title: string;
  platform: string;
  urgency: string;
  trend_type: string;
  adaptation_angle: string;
}

interface NextAction {
  label: string;
  href: string;
  reason: string;
}

interface GrowthHQData {
  chapter: Chapter | null;
  topOpportunity: Opportunity | null;
  pipeline: Pipeline;
  activeCampaigns: Campaign[];
  leadPulse: LeadPulse;
  trends: Trend[];
  nextAction: NextAction | null;
  journalToday: boolean;
  journalCount: number;
  aiDraftCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  tiktok:    'TikTok',
  instagram: 'Instagram',
  facebook:  'Facebook',
  youtube:   'YouTube',
  linkedin:  'LinkedIn',
  website:   'Website',
};

const URGENCY: Record<string, { label: string; bg: string; fg: string }> = {
  forty_eight_hour_window: { label: '48h window',    bg: '#FEF2F2', fg: '#DC2626' },
  two_week_window:         { label: '2-week window', bg: '#FFFBEB', fg: '#D97706' },
  evergreen:               { label: 'Evergreen',     bg: '#F0FDF4', fg: '#16A34A' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-4 rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        {title}
      </h2>
      <Link href={href} className="shrink-0 text-[11px] font-medium hover:underline" style={{ color: dashboardTheme.color.muted }}>
        Open →
      </Link>
    </div>
  );
}

function Empty({ message, href, linkLabel }: { message: string; href: string; linkLabel: string }) {
  return (
    <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
      {message}{' '}
      <Link href={href} className="underline">{linkLabel} →</Link>
    </p>
  );
}

function Chip({ children, bg = 'rgba(15,61,46,0.06)', fg }: { children: ReactNode; bg?: string; fg?: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap"
      style={{ background: bg, color: fg ?? dashboardTheme.color.muted }}
    >
      {children}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-40 rounded-[24px] border border-black/5 bg-white/90 p-5 animate-pulse">
          <div className="mb-3 h-3 w-1/3 rounded bg-black/10" />
          <div className="mb-2 h-2.5 w-full rounded bg-black/5" />
          <div className="h-2.5 w-2/3 rounded bg-black/5" />
        </div>
      ))}
    </div>
  );
}

// ── Section: Current Chapter ──────────────────────────────────────────────────

function ChapterSection({ chapter }: { chapter: Chapter | null }) {
  return (
    <Card>
      <SectionHeader title="Current Chapter" href="/dashboard/story-engine/current-chapter" />
      {chapter ? (
        <>
          <div>
            <p className="font-semibold text-sm leading-snug" style={{ color: dashboardTheme.color.primary }}>
              {chapter.title}
            </p>
            {chapter.started_at && (
              <p className="mt-0.5 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                Since {fmtDate(chapter.started_at)}
              </p>
            )}
          </div>
          {chapter.summary && (
            <p className="line-clamp-3 text-sm leading-5" style={{ color: dashboardTheme.color.muted }}>
              {chapter.summary}
            </p>
          )}
          {chapter.goal && (
            <p className="border-t border-black/5 pt-3 text-xs leading-4" style={{ color: dashboardTheme.color.muted }}>
              <span className="font-medium">Goal:</span> {chapter.goal}
            </p>
          )}
        </>
      ) : (
        <Empty message="No active chapter." href="/dashboard/story-engine/current-chapter" linkLabel="Set one" />
      )}
    </Card>
  );
}

// ── Section: Top Story Opportunity ────────────────────────────────────────────

function OpportunitySection({ opportunity }: { opportunity: Opportunity | null }) {
  return (
    <Card>
      <SectionHeader title="Top Story Opportunity" href="/dashboard/story-engine/opportunities" />
      {opportunity ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold text-sm leading-snug" style={{ color: dashboardTheme.color.primary }}>
              {opportunity.title}
            </p>
            {opportunity.story_score != null && (
              <Chip bg="#F0FDF4" fg="#16A34A">{opportunity.story_score}/100</Chip>
            )}
          </div>
          {opportunity.content_angle && (
            <p className="line-clamp-2 text-sm leading-5" style={{ color: dashboardTheme.color.muted }}>
              {opportunity.content_angle}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {opportunity.suggested_platform && (
              <Chip>{PLATFORM_LABELS[opportunity.suggested_platform] ?? opportunity.suggested_platform}</Chip>
            )}
            {opportunity.suggested_format && (
              <Chip>{opportunity.suggested_format}</Chip>
            )}
          </div>
        </>
      ) : (
        <Empty message="No open opportunities." href="/dashboard/story-engine/journal/new" linkLabel="Write a journal entry to surface one" />
      )}
    </Card>
  );
}

// ── Section: Content Pipeline ─────────────────────────────────────────────────

function PipelineSection({ pipeline }: { pipeline: Pipeline }) {
  const stages = [
    { label: 'Ideas',      count: pipeline.ideas,      href: '/dashboard/content-studio/ideas' },
    { label: 'Scripts',    count: pipeline.scripts,    href: '/dashboard/content-studio/scripts' },
    { label: 'Production', count: pipeline.production, href: '/dashboard/content-studio/production' },
    { label: 'Queue',      count: pipeline.queue,      href: '/dashboard/marketing/publishing' },
  ] as const;

  return (
    <Card>
      <SectionHeader title="Content Pipeline" href="/dashboard/content-studio" />
      <div className="grid grid-cols-4 gap-2">
        {stages.map(({ label, count, href }) => (
          <Link
            key={label}
            href={href}
            className="flex flex-col items-center gap-1 rounded-xl py-3 transition-colors hover:bg-black/[0.02]"
          >
            <span
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: count > 0 ? dashboardTheme.color.primary : dashboardTheme.color.muted }}
            >
              {count}
            </span>
            <span className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>{label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Section: Founder Journal ──────────────────────────────────────────────────

function JournalSection({ journalToday, journalCount }: { journalToday: boolean; journalCount: number }) {
  return (
    <Card>
      <SectionHeader title="Founder Journal" href="/dashboard/story-engine/journal" />
      <div className="flex items-end justify-between gap-4">
        <div>
          {journalToday ? (
            <>
              <p className="text-sm font-semibold" style={{ color: '#047857' }}>
                Captured today ✓
              </p>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                {journalCount} {journalCount === 1 ? 'entry' : 'entries'} total
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: dashboardTheme.color.muted }}>
                No capture yet today
              </p>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                {journalCount} {journalCount === 1 ? 'entry' : 'entries'} total
              </p>
            </>
          )}
        </div>
        <Link
          href="/dashboard/story-engine/journal"
          className="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
          style={{ background: dashboardTheme.color.primary }}
        >
          {journalToday ? 'View entry →' : '+ Capture now'}
        </Link>
      </div>
    </Card>
  );
}

// ── Section: Active Campaigns ─────────────────────────────────────────────────

function CampaignsSection({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <Card>
      <SectionHeader title="Active Campaigns" href="/dashboard/marketing/campaigns" />
      {campaigns.length > 0 ? (
        <div className="flex flex-col gap-3">
          {campaigns.map((c) => (
            <div key={c.id} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium leading-snug" style={{ color: dashboardTheme.color.primary }}>
                  {c.name}
                </p>
                {c.channels.length > 0 && (
                  <div className="flex shrink-0 gap-1">
                    {c.channels.slice(0, 3).map((ch) => (
                      <Chip key={ch} bg="#F0FDF4" fg="#16A34A">
                        {PLATFORM_LABELS[ch] ?? ch}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
              {c.goal && (
                <p className="line-clamp-1 text-xs" style={{ color: dashboardTheme.color.muted }}>{c.goal}</p>
              )}
              {(c.start_date || c.end_date) && (
                <p className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                  {c.start_date ? fmtDate(c.start_date) : '—'} – {c.end_date ? fmtDate(c.end_date) : 'Ongoing'}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty message="No active campaigns." href="/dashboard/marketing/campaigns" linkLabel="Create one" />
      )}
    </Card>
  );
}

// ── Section: Lead Pulse ───────────────────────────────────────────────────────

function LeadPulseSection({ leadPulse }: { leadPulse: LeadPulse }) {
  const stats = [
    { label: 'New (7d)',       count: leadPulse.new,              accent: dashboardTheme.color.primary },
    { label: 'HOT',           count: leadPulse.hot,              accent: '#DC2626' },
    { label: 'Awaiting reply', count: leadPulse.awaitingResponse, accent: '#D97706' },
  ] as const;

  return (
    <Card>
      <SectionHeader title="Lead Pulse" href="/dashboard/leads" />
      <div className="grid grid-cols-3 gap-2">
        {stats.map(({ label, count, accent }) => (
          <div key={label} className="flex flex-col items-center gap-1 rounded-xl py-3">
            <span
              className="text-2xl font-bold tabular-nums leading-none"
              style={{ color: count > 0 ? accent : dashboardTheme.color.muted }}
            >
              {count}
            </span>
            <span className="text-center text-[11px]" style={{ color: dashboardTheme.color.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Section: Trend Watch ──────────────────────────────────────────────────────

function TrendWatchSection({ trends }: { trends: Trend[] }) {
  return (
    <Card>
      <SectionHeader title="Trend Watch" href="/dashboard/research-lab/trends" />
      {trends.length > 0 ? (
        <div className="flex flex-col divide-y divide-black/5">
          {trends.map((t) => {
            const u = URGENCY[t.urgency];
            return (
              <div key={t.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-snug" style={{ color: dashboardTheme.color.primary }}>
                    {t.title}
                  </p>
                  <p className="mt-0.5 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                    {PLATFORM_LABELS[t.platform] ?? t.platform} · {t.trend_type}
                  </p>
                </div>
                {u && <Chip bg={u.bg} fg={u.fg}>{u.label}</Chip>}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty message="No trends being watched." href="/dashboard/research-lab/trends" linkLabel="Add one" />
      )}
    </Card>
  );
}

// ── Section: Next Recommended Action ─────────────────────────────────────────

function NextActionSection({ action }: { action: NextAction | null }) {
  if (!action) {
    return (
      <div className="rounded-[24px] border border-black/5 bg-white/90 px-5 py-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: dashboardTheme.color.muted }}>
          Next Recommended Action
        </p>
        <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>All clear — no immediate action needed.</p>
      </div>
    );
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-[24px] border px-5 py-4"
      style={{ background: '#F0FDF4', borderColor: 'rgba(22,163,74,0.2)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#15803D' }}>
          Next Recommended Action
        </p>
        <p className="text-sm font-medium" style={{ color: '#14532D' }}>{action.label}</p>
        <p className="mt-0.5 text-xs" style={{ color: '#15803D' }}>{action.reason}</p>
      </div>
      <Link
        href={action.href}
        className="shrink-0 rounded-xl px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        style={{ background: '#1C7C54' }}
      >
        Go →
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GrowthHQPage() {
  const [data, setData] = useState<GrowthHQData | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetch('/api/growth-hq')
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json() as Promise<GrowthHQData>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Growth HQ"
        description="One view of what matters right now — story, content, campaigns, leads, and trends."
      />

      {loadError && (
        <div className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-sm text-red-700">Failed to load data. Refresh to try again.</p>
        </div>
      )}

      {!data && !loadError && <Skeleton />}

      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ChapterSection     chapter={data.chapter} />
            <OpportunitySection opportunity={data.topOpportunity} />
            <PipelineSection    pipeline={data.pipeline} />
            <JournalSection     journalToday={data.journalToday} journalCount={data.journalCount} />
            <CampaignsSection   campaigns={data.activeCampaigns} />
            <LeadPulseSection   leadPulse={data.leadPulse} />
            <TrendWatchSection  trends={data.trends} />
          </div>
          <NextActionSection action={data.nextAction} />
        </>
      )}
    </div>
  );
}
