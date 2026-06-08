'use client';

import { useState } from 'react';
import { glass, brand } from '@/app/ui/theme';
import type {
  ExecutiveDecision,
  ExecutiveTask,
  ExecutiveMetricsSnapshot,
  ExecutiveWeeklyReview,
  DecisionRiskLevel,
} from '@/lib/agents/executive/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  decisions:    ExecutiveDecision[];
  tasks:        ExecutiveTask[];
  snapshots:    ExecutiveMetricsSnapshot[];
  latestReview: ExecutiveWeeklyReview | null;
}

type Tab = 'overview' | 'decisions' | 'tasks' | 'weekly';

// ── Helpers ───────────────────────────────────────────────────────────────────

function riskBadge(level: DecisionRiskLevel) {
  const map: Record<DecisionRiskLevel, { label: string; bg: string; text: string }> = {
    low:    { label: 'Low',    bg: '#E3F1EA', text: brand.accent },
    medium: { label: 'Medium', bg: '#FEF3C7', text: '#92400E' },
    high:   { label: 'High',   bg: '#FEE2E2', text: '#991B1B' },
  };
  const style = map[level] ?? map.low;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { bg: string; text: string }> = {
    pending:  { bg: '#F1F7F3', text: brand.muted },
    approved: { bg: '#E3F1EA', text: brand.accent },
    executed: { bg: '#DCFCE7', text: '#166534' },
    rejected: { bg: '#FEE2E2', text: '#991B1B' },
    deferred: { bg: '#FEF3C7', text: '#92400E' },
  };
  const style = map[status] ?? map.pending;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status}
    </span>
  );
}

function agentLabel(agentId: string) {
  const map: Record<string, string> = {
    'ceo-agent':      'CEO',
    'coo-agent':      'COO',
    'cmo-agent':      'CMO',
    'cfo-agent':      'CFO',
    'chief-of-staff': 'Chief of Staff',
  };
  return map[agentId] ?? agentId;
}

function fmt(n: number | null | undefined, prefix = '') {
  if (n == null) return '—';
  return `${prefix}${n.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null | undefined) {
  if (n == null) return '—';
  return `${(n * 100).toFixed(1)}%`;
}

function relativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600_000);
  if (h < 1)  return 'just now';
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricsRow({ snapshots }: { snapshots: ExecutiveMetricsSnapshot[] }) {
  const latest = snapshots[0];
  if (!latest) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: brand.muted }}>
        No metrics captured yet. Run the executive cron to generate a snapshot.
      </p>
    );
  }

  const stats = [
    { label: 'Revenue (7d)',     value: fmt(latest.revenue_7d_aud, 'A$') },
    { label: 'Jobs (7d)',        value: fmt(latest.jobs_7d) },
    { label: 'Leads (7d)',       value: fmt(latest.leads_7d) },
    { label: 'Conversion',       value: fmtPct(latest.conversion_rate) },
    { label: 'Avg job value',    value: fmt(latest.avg_job_value, 'A$') },
    { label: 'Crew utilisation', value: fmtPct(latest.crew_utilisation) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl p-4"
          style={{ backgroundColor: brand.surface, border: `1px solid ${brand.border}` }}
        >
          <p className="text-[11px] font-medium mb-1" style={{ color: brand.muted }}>{s.label}</p>
          <p className="text-lg font-bold" style={{ color: brand.primary }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function DecisionsPanel({ decisions }: { decisions: ExecutiveDecision[] }) {
  if (decisions.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: brand.muted }}>
        No executive decisions in the last 30 days.
      </p>
    );
  }

  return (
    <div className="divide-y" style={{ borderColor: brand.border }}>
      {decisions.map((d) => (
        <div key={d.id} className="py-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
                {agentLabel(d.agent_id)}
              </span>
              {riskBadge(d.risk_level)}
              {statusBadge(d.status)}
            </div>
            <p className="text-sm font-medium leading-snug" style={{ color: brand.text }}>
              {d.title}
            </p>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: brand.muted }}>
              {d.reasoning}
            </p>
            {d.expected_impact && (
              <p className="text-xs mt-1" style={{ color: brand.accent }}>
                Impact: {d.expected_impact}
              </p>
            )}
          </div>
          <span className="text-[11px] shrink-0 mt-0.5" style={{ color: brand.muted }}>
            {relativeDate(d.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

function TasksPanel({ tasks }: { tasks: ExecutiveTask[] }) {
  if (tasks.length === 0) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: brand.muted }}>
        No open executive tasks.
      </p>
    );
  }

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, normal: 2, low: 3 };
  const sorted = [...tasks].sort(
    (a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2),
  );

  return (
    <div className="divide-y" style={{ borderColor: brand.border }}>
      {sorted.map((t) => (
        <div key={t.id} className="py-3 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: brand.muted }}>
                {agentLabel(t.source_agent_id)}
              </span>
              {t.target_agent_id && (
                <span className="text-[11px]" style={{ color: brand.muted }}>
                  → {t.target_agent_id}
                </span>
              )}
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: t.priority === 'critical' ? '#FEE2E2'
                    : t.priority === 'high' ? '#FEF3C7'
                    : brand.surface,
                  color: t.priority === 'critical' ? '#991B1B'
                    : t.priority === 'high' ? '#92400E'
                    : brand.muted,
                }}
              >
                {t.priority}
              </span>
            </div>
            <p className="text-sm font-medium leading-snug" style={{ color: brand.text }}>
              {t.title}
            </p>
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: brand.muted }}>
              {t.description}
            </p>
          </div>
          <span className="text-[11px] shrink-0 mt-0.5 uppercase font-medium" style={{ color: brand.muted }}>
            {t.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function WeeklyReviewPanel({ review }: { review: ExecutiveWeeklyReview | null }) {
  if (!review) {
    return (
      <p className="text-sm py-6 text-center" style={{ color: brand.muted }}>
        No weekly review generated yet. The learning cron runs on Mondays.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: brand.muted }}>
          Week of {review.week_start}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: brand.text }}>{review.summary}</p>
      </div>

      {review.wins.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: brand.accent }}>
            Wins
          </p>
          <ul className="space-y-1.5">
            {review.wins.map((w, i) => (
              <li key={i} className="text-sm" style={{ color: brand.text }}>
                <span className="font-medium">{w.title}</span>
                {w.detail && <span style={{ color: brand.muted }}> — {w.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#B45309' }}>
            Risks
          </p>
          <ul className="space-y-1.5">
            {review.risks.map((r, i) => (
              <li key={i} className="text-sm" style={{ color: brand.text }}>
                <span className="font-medium">{r.title}</span>
                {r.detail && <span style={{ color: brand.muted }}> — {r.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.priorities.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: brand.primary }}>
            Next week priorities
          </p>
          <ul className="space-y-1.5">
            {review.priorities.map((p, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: brand.text }}>
                <span className="font-medium flex-1">{p.title}</span>
                <span className="text-[11px] shrink-0" style={{ color: brand.muted }}>{p.owner}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExecutiveHQClient({ decisions, tasks, snapshots, latestReview }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: Array<{ id: Tab; label: string; count?: number }> = [
    { id: 'overview',  label: 'Overview' },
    { id: 'decisions', label: 'Decisions', count: decisions.length },
    { id: 'tasks',     label: 'Open tasks', count: tasks.length },
    { id: 'weekly',    label: 'Weekly review' },
  ];

  const pendingDecisions  = decisions.filter((d) => d.status === 'pending').length;
  const executedDecisions = decisions.filter((d) => d.status === 'executed').length;
  const highRiskPending   = decisions.filter((d) => d.status === 'pending' && d.risk_level === 'high').length;

  return (
    <div className="space-y-6 p-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: brand.primary }}>Executive HQ</h1>
        <p className="text-sm mt-0.5" style={{ color: brand.muted }}>
          Strategic decisions and weekly reviews from the executive agent layer.
        </p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: 'Pending review',  value: pendingDecisions,  warn: pendingDecisions > 0 },
          { label: 'Auto-executed',   value: executedDecisions, warn: false },
          { label: 'High-risk queued', value: highRiskPending,  warn: highRiskPending > 0 },
          { label: 'Open tasks',      value: tasks.length,      warn: tasks.length > 5 },
        ].map((chip) => (
          <div
            key={chip.label}
            className="flex items-center gap-2 rounded-full px-3 py-1.5"
            style={{
              backgroundColor: chip.warn && chip.value > 0 ? '#FEF3C7' : brand.surface,
              border: `1px solid ${chip.warn && chip.value > 0 ? '#FCD34D' : brand.border}`,
            }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: chip.warn && chip.value > 0 ? '#92400E' : brand.primary }}
            >
              {chip.value}
            </span>
            <span className="text-xs" style={{ color: brand.muted }}>{chip.label}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: brand.border }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="px-4 py-2 text-sm font-medium transition-colors relative"
            style={{
              color: activeTab === t.id ? brand.accent : brand.muted,
              borderBottom: activeTab === t.id ? `2px solid ${brand.accent}` : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {t.label}
            {t.count != null && t.count > 0 && (
              <span
                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: brand.accentSoft, color: brand.accent }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className={`rounded-2xl p-5 ${glass}`}>
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: brand.muted }}>
                Latest metrics snapshot
              </p>
              <MetricsRow snapshots={snapshots} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: brand.muted }}>
                Recent decisions
              </p>
              <DecisionsPanel decisions={decisions.slice(0, 8)} />
            </div>
          </div>
        )}

        {activeTab === 'decisions' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: brand.muted }}>
              All decisions — last 30 days
            </p>
            <DecisionsPanel decisions={decisions} />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: brand.muted }}>
              Open tasks from executive layer
            </p>
            <TasksPanel tasks={tasks} />
          </div>
        )}

        {activeTab === 'weekly' && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-4" style={{ color: brand.muted }}>
              Latest weekly review
            </p>
            <WeeklyReviewPanel review={latestReview} />
          </div>
        )}
      </div>
    </div>
  );
}
