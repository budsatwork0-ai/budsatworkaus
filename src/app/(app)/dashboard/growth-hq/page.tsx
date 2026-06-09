'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { WorkbenchHeader, WorkbenchTabs } from '../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import GrowthValidationView from './GrowthValidationView';

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
  content_idea_created: boolean;
}

interface Pipeline {
  ideas: number;
  scripts: number;
  production: number;
  queue: number;
  pendingActions: number;
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
  adaptation_score: number | null;
  adaptation_reason: string | null;
}

interface NextAction {
  label: string;
  href: string;
  reason: string;
}

interface AgentActionItem {
  id: string;
  agent_id: string;
  action_type: string;
  preview: string;
  created_at: string;
  target_table: string | null;
  payload: Record<string, unknown> | null;
}

interface PipelineEventItem {
  id: string;
  event_type: string;
  source_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface ScoredIdea {
  id: string;
  title: string;
  idea_score: number;
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
  agentActions: AgentActionItem[];
  recentPipelineEvents: PipelineEventItem[];
  topIdea: ScoredIdea | null;
  openOpportunitiesCount: number;
  pendingActionsCount: number;
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

const AGENT_NAMES: Record<string, string> = {
  'arc-monitor':         'Arc Monitor',
  'thread-progress':     'Thread Progress',
  'production-monitor':  'Production Monitor',
  'asset-matcher':       'Asset Matcher',
  'consent-monitor':     'Consent Monitor',
  'campaign-reporter':   'Campaign Reporter',
  'cadence-monitor':     'Cadence Monitor',
  'format-analyst':      'Format Analyst',
  'trend-scout':         'Trend Scout',
  'adaptation-validator':'Adaptation Validator',
};

const TARGET_HREF: Record<string, string> = {
  story_arcs:                '/dashboard/story-engine/arcs',
  open_threads:              '/dashboard/story-engine/threads',
  content_production_cards:  '/dashboard/content-studio/production',
  content_assets:            '/dashboard/content-studio/assets',
  marketing_campaigns:       '/dashboard/marketing/campaigns',
  social_channels:           '/dashboard/marketing/channels',
  marketing_publishing_queue:'/dashboard/marketing/publishing',
  research_trends:           '/dashboard/research-lab/trends',
};

const EVENT_AGENT: Record<string, string> = {
  arc_stale_flag:           'arc-monitor',
  thread_stale_flag:        'thread-progress',
  production_card_stale_flag: 'production-monitor',
  asset_match_suggested:    'asset-matcher',
  consent_unresolved_flag:  'consent-monitor',
  campaign_kpi_report:      'campaign-reporter',
  cadence_behind_flag:      'cadence-monitor',
  format_learning_report:   'format-analyst',
  format_learning_insight:  'format-analyst',
  trend_adapted:            'adaptation-validator',
};

const EVENT_HREF: Record<string, string> = {
  arc_stale_flag:            '/dashboard/story-engine/arcs',
  thread_stale_flag:         '/dashboard/story-engine/threads',
  production_card_stale_flag:'/dashboard/content-studio/production',
  asset_match_suggested:     '/dashboard/content-studio/assets',
  consent_unresolved_flag:   '/dashboard/content-studio/assets',
  campaign_kpi_report:       '/dashboard/marketing/campaigns',
  cadence_behind_flag:       '/dashboard/marketing/channels',
  format_learning_report:    '/dashboard/research-lab',
  format_learning_insight:   '/dashboard/research-lab',
  trend_adapted:             '/dashboard/research-lab/trends',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function eventText(event: PipelineEventItem): string {
  const m = (event.metadata ?? {}) as Record<string, unknown>;
  switch (event.event_type) {
    case 'arc_stale_flag':
      return `"${m.title}" hasn't been updated in ${m.days_since_update} days`;
    case 'thread_stale_flag':
      return `Thread "${m.title}" has had no progress in ${m.days_since_update} days`;
    case 'production_card_stale_flag':
      return `Production card "${m.title}" stalled for ${m.days_since_update} days`;
    case 'asset_match_suggested':
      return 'Cleared asset suggested for an active production card';
    case 'consent_unresolved_flag':
      return `Consent unresolved on "${m.title}" for ${m.days_pending} days`;
    case 'campaign_kpi_report':
      return 'Campaign KPI report is ready for review';
    case 'cadence_behind_flag':
      return `${m.channel} is ${m.posts_behind} post${m.posts_behind !== 1 ? 's' : ''} behind cadence target`;
    case 'format_learning_report':
      return `Weekly format learning report ready (${m.analysis_week})`;
    case 'format_learning_insight':
      return `New insight: ${String(m.insight_key ?? '').replace(/_/g, ' ')}`;
    case 'trend_adapted':
      return `"${m.title}" scored ${m.adaptation_score}/100 for story fit`;
    default:
      return event.event_type.replace(/_/g, ' ');
  }
}

interface Finding {
  id: string;
  kind: 'action' | 'event';
  agentId: string;
  agentName: string;
  text: string;
  timestamp: string;
  href: string;
}

function buildFindings(actions: AgentActionItem[], events: PipelineEventItem[]): Finding[] {
  const actionFindings: Finding[] = actions.map((a) => ({
    id:        a.id,
    kind:      'action',
    agentId:   a.agent_id,
    agentName: AGENT_NAMES[a.agent_id] ?? a.agent_id,
    text:      a.preview,
    timestamp: a.created_at,
    href:      TARGET_HREF[a.target_table ?? ''] ?? '/dashboard/agents',
  }));

  const eventFindings: Finding[] = events.map((e) => ({
    id:        e.id,
    kind:      'event',
    agentId:   EVENT_AGENT[e.event_type] ?? 'pipeline',
    agentName: AGENT_NAMES[EVENT_AGENT[e.event_type] ?? ''] ?? 'Pipeline',
    text:      eventText(e),
    timestamp: e.created_at,
    href:      EVENT_HREF[e.event_type] ?? '/dashboard/growth-hq',
  }));

  return [...actionFindings, ...eventFindings]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);
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

// ── Section: Agent Findings ───────────────────────────────────────────────────

function AgentFindingsSection({
  actions,
  events,
  pendingCount,
}: {
  actions: AgentActionItem[];
  events: PipelineEventItem[];
  pendingCount: number;
}) {
  const findings = buildFindings(actions, events);

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
          Agent Findings
        </h2>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Chip bg="#FEF2F2" fg="#DC2626">{pendingCount} need review</Chip>
          )}
          <Link href="/dashboard/agents" className="shrink-0 text-[11px] font-medium hover:underline" style={{ color: dashboardTheme.color.muted }}>
            All agents →
          </Link>
        </div>
      </div>

      {findings.length === 0 ? (
        <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
          No findings in the last 48 hours. Agents are monitoring.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-black/5">
          {findings.map((f) => (
            <div key={f.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                    style={{
                      background: f.kind === 'action' ? '#FEF9C3' : '#F0FDF4',
                      color:      f.kind === 'action' ? '#854D0E' : '#15803D',
                    }}
                  >
                    {f.agentName}
                  </span>
                  {f.kind === 'action' && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
                      style={{ background: '#FEF2F2', color: '#DC2626' }}
                    >
                      Needs review
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs leading-4" style={{ color: dashboardTheme.color.primary }}>
                  {f.text}
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                  {timeAgo(f.timestamp)}
                </p>
              </div>
              <Link
                href={f.href}
                className="shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition hover:opacity-80"
                style={{
                  background: f.kind === 'action' ? '#FEF2F2' : 'rgba(15,61,46,0.06)',
                  color:      f.kind === 'action' ? '#DC2626'  : dashboardTheme.color.muted,
                }}
              >
                {f.kind === 'action' ? 'Review →' : 'View →'}
              </Link>
            </div>
          ))}
        </div>
      )}
    </Card>
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

// ── Section: Top Opportunity + Top Idea ───────────────────────────────────────

function OpportunitySection({
  opportunity,
  topIdea,
  openCount,
}: {
  opportunity: Opportunity | null;
  topIdea: ScoredIdea | null;
  openCount: number;
}) {
  return (
    <Card>
      <SectionHeader title="Top Opportunity" href="/dashboard/story-engine/opportunities" />
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
          {topIdea && (
            <Link
              href="/dashboard/content-studio/ideas"
              className="flex items-center justify-between gap-2 rounded-xl border border-black/5 px-3 py-2.5 transition hover:bg-black/[0.02]"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
                  Top Idea
                </p>
                <p className="mt-0.5 truncate text-sm font-medium leading-snug" style={{ color: dashboardTheme.color.primary }}>
                  {topIdea.title}
                </p>
              </div>
              <Chip bg="#F0FDF4" fg="#16A34A">{topIdea.idea_score}/100</Chip>
            </Link>
          )}
          {openCount > 1 && (
            <p className="text-xs" style={{ color: dashboardTheme.color.muted }}>
              {openCount - 1} more open {openCount - 1 === 1 ? 'opportunity' : 'opportunities'}{' '}
              <Link href="/dashboard/story-engine/opportunities" className="underline">
                waiting
              </Link>
              .
            </p>
          )}
        </>
      ) : (
        <Empty
          message="No open opportunities."
          href="/dashboard/story-engine/journal/new"
          linkLabel="Write a journal entry to surface one"
        />
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

  const isHealthy = pipeline.pendingActions === 0;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
          Content Pipeline
        </h2>
        <div className="flex items-center gap-2">
          <Chip
            bg={isHealthy ? '#F0FDF4' : '#FFFBEB'}
            fg={isHealthy ? '#16A34A' : '#D97706'}
          >
            {isHealthy ? 'Flowing' : `${pipeline.pendingActions} pending`}
          </Chip>
          <Link href="/dashboard/content-studio" className="shrink-0 text-[11px] font-medium hover:underline" style={{ color: dashboardTheme.color.muted }}>
            Open →
          </Link>
        </div>
      </div>
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

type IdeaCreateStatus = 'creating' | 'done' | 'error';

function TrendWatchSection({
  trends,
  ideaStatus,
  onCreateIdea,
}: {
  trends: Trend[];
  ideaStatus: Record<string, IdeaCreateStatus>;
  onCreateIdea: (trend: Trend) => void;
}) {
  return (
    <Card>
      <SectionHeader title="Trend Watch" href="/dashboard/research-lab/trends" />
      {trends.length > 0 ? (
        <div className="flex flex-col divide-y divide-black/5">
          {trends.map((t) => {
            const u      = URGENCY[t.urgency];
            const score  = t.adaptation_score;
            const isHighFit = (score ?? 0) >= 70;
            const status = ideaStatus[t.id];

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
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {score != null && (
                      <Chip
                        bg={score >= 70 ? '#F0FDF4' : score >= 40 ? '#FFFBEB' : 'rgba(15,61,46,0.06)'}
                        fg={score >= 70 ? '#16A34A' : score >= 40 ? '#D97706' : dashboardTheme.color.muted}
                      >
                        {score}/100
                      </Chip>
                    )}
                    {u && <Chip bg={u.bg} fg={u.fg}>{u.label}</Chip>}
                  </div>
                  {isHighFit && (
                    <button
                      disabled={status === 'creating' || status === 'done'}
                      onClick={() => onCreateIdea(t)}
                      className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition-opacity disabled:opacity-60"
                      style={{
                        background: status === 'done'    ? '#F0FDF4'
                                  : status === 'error'   ? '#FEF2F2'
                                  : '#1C7C54',
                        color:      status === 'done'    ? '#16A34A'
                                  : status === 'error'   ? '#DC2626'
                                  : 'white',
                      }}
                    >
                      {status === 'creating' ? '…'
                       : status === 'done'    ? 'Created ✓'
                       : status === 'error'   ? 'Retry'
                       : 'Create Idea'}
                    </button>
                  )}
                </div>
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
          Next Action
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
          Next Action
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

type HQTab = 'hq' | 'validation';

const HQ_TABS: Array<{ key: HQTab; label: string }> = [
  { key: 'hq',         label: 'Growth HQ' },
  { key: 'validation', label: 'Validation' },
];

export default function GrowthHQPage() {
  const [activeTab,  setActiveTab]  = useState<HQTab>('hq');
  const [data,      setData]      = useState<GrowthHQData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [ideaStatus, setIdeaStatus] = useState<Record<string, IdeaCreateStatus>>({});

  useEffect(() => {
    fetch('/api/growth-hq')
      .then((r) => {
        if (!r.ok) throw new Error('failed');
        return r.json() as Promise<GrowthHQData>;
      })
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  const createIdeaFromTrend = useCallback(async (trend: Trend) => {
    setIdeaStatus((prev) => ({ ...prev, [trend.id]: 'creating' }));
    try {
      const res = await fetch('/api/content-ideas', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:         trend.title,
          platform_fit:  trend.platform,
          hook:          trend.adaptation_angle || '',
          content_angle: trend.adaptation_reason || trend.adaptation_angle || '',
          notes:         `Created from ${PLATFORM_LABELS[trend.platform] ?? trend.platform} trend`,
          status:        'captured',
        }),
      });
      if (!res.ok) throw new Error('failed');
      setIdeaStatus((prev) => ({ ...prev, [trend.id]: 'done' }));
    } catch {
      setIdeaStatus((prev) => ({ ...prev, [trend.id]: 'error' }));
    }
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Growth & Marketing"
        title="Growth HQ"
        description="What happened overnight, what needs your attention, and what to do next."
      />

      <WorkbenchTabs
        tabs={HQ_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'validation' && <GrowthValidationView />}

      {activeTab === 'hq' && (
        <>
          {loadError && (
            <div className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4">
              <p className="text-sm text-red-700">Failed to load data. Refresh to try again.</p>
            </div>
          )}

          {!data && !loadError && <Skeleton />}

          {data && (
            <>
              <AgentFindingsSection
                actions={data.agentActions}
                events={data.recentPipelineEvents}
                pendingCount={data.pendingActionsCount}
              />
              <div className="grid gap-4 lg:grid-cols-2">
                <ChapterSection     chapter={data.chapter} />
                <OpportunitySection
                  opportunity={data.topOpportunity}
                  topIdea={data.topIdea}
                  openCount={data.openOpportunitiesCount}
                />
                <PipelineSection    pipeline={data.pipeline} />
                <JournalSection     journalToday={data.journalToday} journalCount={data.journalCount} />
                <CampaignsSection   campaigns={data.activeCampaigns} />
                <LeadPulseSection   leadPulse={data.leadPulse} />
                <TrendWatchSection
                  trends={data.trends}
                  ideaStatus={ideaStatus}
                  onCreateIdea={createIdeaFromTrend}
                />
              </div>
              <NextActionSection action={data.nextAction} />
            </>
          )}
        </>
      )}
    </div>
  );
}
