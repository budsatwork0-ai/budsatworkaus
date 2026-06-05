'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  RESEARCH_TREND_PLATFORMS,
  RESEARCH_TREND_TYPES,
  RESEARCH_TREND_URGENCIES,
  RESEARCH_TREND_STATUSES,
  PLATFORM_LABELS,
  TREND_TYPE_LABELS,
  URGENCY_LABELS,
  URGENCY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  type ResearchTrend,
  type ResearchTrendPlatform,
  type ResearchTrendType,
  type ResearchTrendUrgency,
  type ResearchTrendStatus,
} from '@/types/research-trend';

type Draft = {
  platform:         ResearchTrendPlatform;
  title:            string;
  description:      string;
  trend_type:       ResearchTrendType;
  urgency:          ResearchTrendUrgency;
  adaptation_angle: string;
  story_arc_id:     string;
  status:           ResearchTrendStatus;
  notes:            string;
};

const EMPTY_DRAFT: Draft = {
  platform:         'tiktok',
  title:            '',
  description:      '',
  trend_type:       'format',
  urgency:          'evergreen',
  adaptation_angle: '',
  story_arc_id:     '',
  status:           'watching',
  notes:            '',
};

function trendToDraft(t: ResearchTrend): Draft {
  return {
    platform:         t.platform,
    title:            t.title,
    description:      t.description,
    trend_type:       t.trend_type,
    urgency:          t.urgency,
    adaptation_angle: t.adaptation_angle,
    story_arc_id:     t.story_arc_id ?? '',
    status:           t.status,
    notes:            t.notes,
  };
}

function draftToPayload(d: Draft) {
  return {
    platform:         d.platform,
    title:            d.title.trim(),
    description:      d.description.trim(),
    trend_type:       d.trend_type,
    urgency:          d.urgency,
    adaptation_angle: d.adaptation_angle.trim(),
    story_arc_id:     d.story_arc_id.trim() || null,
    status:           d.status,
    notes:            d.notes.trim(),
  };
}

export default function TrendsPage() {
  const [trends, setTrends]     = useState<ResearchTrend[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [adding, setAdding]     = useState(false);
  const [draft, setDraft]       = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving]     = useState(false);

  // Filters
  const [filterPlatform, setFilterPlatform]     = useState('');
  const [filterStatus, setFilterStatus]         = useState('');
  const [filterTrendType, setFilterTrendType]   = useState('');
  const [filterUrgency, setFilterUrgency]       = useState('');

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (filterPlatform)  params.set('platform',   filterPlatform);
    if (filterStatus)    params.set('status',     filterStatus);
    if (filterTrendType) params.set('trend_type', filterTrendType);
    if (filterUrgency)   params.set('urgency',    filterUrgency);
    return params.toString();
  }, [filterPlatform, filterStatus, filterTrendType, filterUrgency]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQuery();
      const res = await fetch(`/api/research-trends${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setTrends(json.trends ?? []);
    } catch {
      setError('Could not load trends.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/research-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToPayload(draft)),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to create trend'); return; }
      setTrends((prev) => [data as ResearchTrend, ...prev]);
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      toast.success('Trend added');
    } catch {
      toast.error('Failed to create trend');
    } finally {
      setSaving(false);
    }
  }

  function upsert(updated: ResearchTrend) {
    setTrends((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  function remove(id: string) {
    setTrends((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Research Lab"
        title="Trend Intelligence"
        description="Manual trend entries. Research inputs only — trends do not create content ideas."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/research-lab"
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Research Lab
            </Link>
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                style={{ background: dashboardTheme.color.primary, color: '#fff' }}
              >
                Add trend
              </button>
            )}
          </div>
        }
      />

      <div
        className="rounded-[20px] border px-5 py-4"
        style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,0.25)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>
          Phase 5A boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Manual trend entry only. No scraping, no external APIs, no AI generation, no agents, no automations. Trends are research inputs — they do not create content ideas.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterSelect
          value={filterPlatform}
          onChange={setFilterPlatform}
          options={[
            { value: '', label: 'All platforms' },
            ...RESEARCH_TREND_PLATFORMS.map((p) => ({ value: p, label: PLATFORM_LABELS[p] })),
          ]}
        />
        <FilterSelect
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: '', label: 'All statuses' },
            ...RESEARCH_TREND_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
          ]}
        />
        <FilterSelect
          value={filterTrendType}
          onChange={setFilterTrendType}
          options={[
            { value: '', label: 'All types' },
            ...RESEARCH_TREND_TYPES.map((t) => ({ value: t, label: TREND_TYPE_LABELS[t] })),
          ]}
        />
        <FilterSelect
          value={filterUrgency}
          onChange={setFilterUrgency}
          options={[
            { value: '', label: 'All urgencies' },
            ...RESEARCH_TREND_URGENCIES.map((u) => ({ value: u, label: URGENCY_LABELS[u] })),
          ]}
        />
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
              New Trend
            </h3>
            <button
              type="button"
              onClick={() => { setAdding(false); setDraft(EMPTY_DRAFT); }}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
              style={{ color: dashboardTheme.color.muted }}
            >
              Cancel
            </button>
          </div>
          <TrendForm
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSubmit={create}
            submitLabel="Add trend"
          />
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-[24px] border border-black/5 bg-white/80" />
          ))}
        </div>
      ) : trends.length === 0 ? (
        <div
          className="rounded-[24px] border border-dashed border-black/10 bg-white/60 px-6 py-10 text-center"
        >
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
            No trends yet. Add the first one above.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {trends.map((trend) => (
            <TrendCard key={trend.id} trend={trend} onUpdated={upsert} onDeleted={remove} />
          ))}
        </div>
      )}
    </div>
  );
}

function TrendCard({
  trend,
  onUpdated,
  onDeleted,
}: {
  trend: ResearchTrend;
  onUpdated: (t: ResearchTrend) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [draft, setDraft]       = useState<Draft>(() => trendToDraft(trend));
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!editing) setDraft(trendToDraft(trend));
  }, [trend, editing]);

  async function save(patch?: Partial<Draft>) {
    const d = { ...draft, ...patch };
    setSaving(true);
    try {
      const res = await fetch(`/api/research-trends/${trend.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftToPayload(d)),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to update trend'); return; }
      onUpdated(data as ResearchTrend);
      setEditing(false);
      toast.success('Trend updated');
    } catch {
      toast.error('Failed to update trend');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this trend? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/research-trends/${trend.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onDeleted(trend.id);
      toast.success('Trend deleted');
    } catch {
      toast.error('Failed to delete trend');
    } finally {
      setSaving(false);
    }
  }

  const urgencyStyle = URGENCY_STYLES[trend.urgency];
  const statusStyle  = STATUS_STYLES[trend.status];

  if (editing) {
    return (
      <article className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
            Edit: {trend.title}
          </h3>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
            style={{ color: dashboardTheme.color.muted }}
          >
            Cancel
          </button>
        </div>
        <TrendForm
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSubmit={() => save()}
          submitLabel="Save changes"
        />
        <button
          type="button"
          onClick={remove}
          disabled={saving}
          className="mt-3 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50 disabled:opacity-50"
          style={{ color: '#B91C1C' }}
        >
          Delete trend
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              {PLATFORM_LABELS[trend.platform]}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: '#F5F3FF', color: '#7C3AED' }}
            >
              {TREND_TYPE_LABELS[trend.trend_type]}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: urgencyStyle.bg, color: urgencyStyle.fg }}
            >
              {URGENCY_LABELS[trend.urgency]}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ background: statusStyle.bg, color: statusStyle.fg }}
            >
              {STATUS_LABELS[trend.status]}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
            {trend.title}
          </h3>
          {trend.description && (
            <p className="mt-1 text-xs leading-5" style={{ color: dashboardTheme.color.text }}>
              {trend.description}
            </p>
          )}
          {trend.adaptation_angle && (
            <p className="mt-2 text-xs" style={{ color: dashboardTheme.color.muted }}>
              <strong>Adaptation:</strong> {trend.adaptation_angle}
            </p>
          )}
          {trend.notes && (
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              <strong>Notes:</strong> {trend.notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
          style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
        >
          Edit
        </button>
      </div>

      {/* Quick status transitions */}
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-black/5 pt-3">
        {RESEARCH_TREND_STATUSES.filter((s) => s !== trend.status).map((s) => {
          const style = STATUS_STYLES[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => save({ status: s })}
              disabled={saving}
              className="rounded-full px-2 py-1 text-[10px] font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: style.bg, color: style.fg }}
            >
              {STATUS_LABELS[s]}
            </button>
          );
        })}
      </div>
    </article>
  );
}

function TrendForm({
  draft,
  setDraft,
  saving,
  onSubmit,
  submitLabel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Platform</Label>
          <select
            value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value as ResearchTrendPlatform })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {RESEARCH_TREND_PLATFORMS.map((p) => (
              <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
            ))}
          </select>
        </label>
        <label>
          <Label>Trend type</Label>
          <select
            value={draft.trend_type}
            onChange={(e) => setDraft({ ...draft, trend_type: e.target.value as ResearchTrendType })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {RESEARCH_TREND_TYPES.map((t) => (
              <option key={t} value={t}>{TREND_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Title *</Label>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Short descriptive title"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Description</Label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={3}
          placeholder="What is this trend? Where did you observe it?"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Urgency</Label>
          <select
            value={draft.urgency}
            onChange={(e) => setDraft({ ...draft, urgency: e.target.value as ResearchTrendUrgency })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {RESEARCH_TREND_URGENCIES.map((u) => (
              <option key={u} value={u}>{URGENCY_LABELS[u]}</option>
            ))}
          </select>
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ResearchTrendStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {RESEARCH_TREND_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Adaptation angle</Label>
        <textarea
          value={draft.adaptation_angle}
          onChange={(e) => setDraft({ ...draft, adaptation_angle: e.target.value })}
          rows={2}
          placeholder="How does this trend map to Buds At Work content?"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Story Arc ID <span style={{ color: dashboardTheme.color.muted, fontWeight: 400 }}>(optional)</span></Label>
        <input
          value={draft.story_arc_id}
          onChange={(e) => setDraft({ ...draft, story_arc_id: e.target.value })}
          placeholder="UUID of linked story arc"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm font-mono outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Notes</Label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary, color: '#fff' }}
        >
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
      style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
      {children}
    </span>
  );
}
