'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ImprovementItem, ImprovementsResponse } from '@/app/api/bud/improvements/route';

/* ── helpers ─────────────────────────────────────────────────────────────── */

function rel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return 'today';
  if (d === 1) return '1d ago';
  if (d < 30) return `${d}d ago`;
  const m = Math.floor(d / 30);
  return `${m}mo ago`;
}

const RISK_STYLES: Record<ImprovementItem['risk_level'], string> = {
  low:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  medium:   'bg-amber-500/10  text-amber-400  border-amber-500/20',
  high:     'bg-orange-500/10 text-orange-400 border-orange-500/20',
  critical: 'bg-red-500/10   text-red-400    border-red-500/20',
};

const SOURCE_STYLES: Record<ImprovementItem['source'], string> = {
  vault:    'bg-violet-500/10 text-violet-400 border-violet-500/20',
  graphify: 'bg-sky-500/10    text-sky-400    border-sky-500/20',
  manual:   'bg-white/5       text-white/50   border-white/10',
  agent:    'bg-teal-500/10   text-teal-400   border-teal-500/20',
};

const STATUS_LABELS: Record<ImprovementItem['status'], string> = {
  open:        'Open',
  in_progress: 'In progress',
  completed:   'Completed',
  dismissed:   'Dismissed',
};

/* ── sub-components ──────────────────────────────────────────────────────── */

function Chip({ label, style }: { label: string; style: string }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style}`}>
      {label}
    </span>
  );
}

function ImprovementCard({
  item,
  onStatusChange,
}: {
  item: ImprovementItem;
  onStatusChange: (id: string, status: ImprovementItem['status']) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleStatus(next: ImprovementItem['status']) {
    setUpdating(true);
    try {
      const res = await fetch('/api/bud/improvements', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, status: next }),
      });
      if (res.ok) onStatusChange(item.id, next);
    } finally {
      setUpdating(false);
    }
  }

  const nextStatus: Record<ImprovementItem['status'], ImprovementItem['status'] | null> = {
    open:        'in_progress',
    in_progress: 'completed',
    completed:   null,
    dismissed:   null,
  };

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-white/[0.12]">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Chip label={item.risk_level} style={RISK_STYLES[item.risk_level]} />
          <Chip label={item.source} style={SOURCE_STYLES[item.source]} />
          <Chip label={STATUS_LABELS[item.status]} style="bg-white/5 text-white/40 border-white/[0.07]" />
        </div>
        <span className="text-[11px] text-white/30">{rel(item.created_at)}</span>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-white/90">{item.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-white/55">{item.issue}</p>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
          {item.root_cause && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Root cause</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.root_cause}</p>
            </div>
          )}
          {item.evidence_ref && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Evidence</p>
              <p className="mt-0.5 text-[13px] font-mono text-white/50">{item.evidence_ref}</p>
            </div>
          )}
          {item.affected_files.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Affected files</p>
              <ul className="mt-0.5 space-y-0.5">
                {item.affected_files.map(f => (
                  <li key={f} className="text-[12px] font-mono text-white/50">{f}</li>
                ))}
              </ul>
            </div>
          )}
          {item.rollback_plan && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">Rollback</p>
              <p className="mt-0.5 text-[13px] text-white/55">{item.rollback_plan}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => setExpanded(x => !x)}
          className="text-[11px] text-white/40 hover:text-white/70"
        >
          {expanded ? 'Less' : 'Details'}
        </button>

        {nextStatus[item.status] && (
          <button
            disabled={updating}
            onClick={() => void handleStatus(nextStatus[item.status]!)}
            className="ml-auto rounded-md border border-sky-400/20 bg-sky-500/[0.08] px-2.5 py-1 text-[11px] font-medium text-sky-400 hover:bg-sky-500/[0.15] disabled:opacity-40"
          >
            {updating ? '…' : `Mark ${STATUS_LABELS[nextStatus[item.status]!]}`}
          </button>
        )}

        {item.status === 'open' && (
          <button
            disabled={updating}
            onClick={() => void handleStatus('dismissed')}
            className="rounded-md border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/35 hover:text-white/60 disabled:opacity-40"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

function AddImprovementForm({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [issue, setIssue] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [risk, setRisk] = useState<ImprovementItem['risk_level']>('low');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch('/api/bud/improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, issue, root_cause: rootCause || null, risk_level: risk }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Failed');
      }
      setTitle(''); setIssue(''); setRootCause(''); setRisk('low');
      setStatus('idle'); setOpen(false);
      onAdded();
    } catch (e) {
      setStatus('error');
      setErr(e instanceof Error ? e.message : 'Unknown error');
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-dashed border-white/[0.12] bg-transparent px-4 py-2.5 text-[12px] font-medium text-white/40 hover:border-white/20 hover:text-white/60"
      >
        + Add improvement
      </button>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-xl border border-white/[0.09] bg-white/[0.03] p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">New improvement</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Title"
        required
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
      />
      <textarea
        value={issue}
        onChange={e => setIssue(e.target.value)}
        placeholder="Describe the issue"
        required
        rows={2}
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
      />
      <input
        value={rootCause}
        onChange={e => setRootCause(e.target.value)}
        placeholder="Root cause (optional)"
        className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/20"
      />
      <select
        value={risk}
        onChange={e => setRisk(e.target.value as ImprovementItem['risk_level'])}
        className="rounded-lg border border-white/[0.08] bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
      >
        <option value="low">Low risk</option>
        <option value="medium">Medium risk</option>
        <option value="high">High risk</option>
        <option value="critical">Critical risk</option>
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-lg border border-teal-400/30 bg-teal-500/[0.10] px-4 py-2 text-sm font-medium text-teal-300 hover:bg-teal-500/[0.18] disabled:opacity-40"
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-white/35 hover:text-white/60">
          Cancel
        </button>
        {status === 'error' && <span className="text-sm text-red-400">{err}</span>}
      </div>
    </form>
  );
}

/* ── main component ──────────────────────────────────────────────────────── */

type StatusFilter = ImprovementItem['status'] | 'all';

export function ImprovementsTab() {
  const [data, setData] = useState<ImprovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('open');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/bud/improvements');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as ImprovementsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function handleStatusChange(id: string, status: ImprovementItem['status']) {
    setData(prev => {
      if (!prev) return prev;
      const items = prev.items.map(i => i.id === id ? { ...i, status } : i);
      return {
        items,
        totals: {
          open:        items.filter(i => i.status === 'open').length,
          in_progress: items.filter(i => i.status === 'in_progress').length,
          completed:   items.filter(i => i.status === 'completed').length,
          dismissed:   items.filter(i => i.status === 'dismissed').length,
        },
      };
    });
  }

  if (loading) return <p className="text-sm text-white/40">Loading improvements…</p>;
  if (error)   return <p className="text-sm text-red-400">Error: {error}</p>;
  if (!data)   return null;

  const { totals } = data;
  const visible = filter === 'all' ? data.items : data.items.filter(i => i.status === filter);

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'open',        label: 'Open',        count: totals.open },
    { key: 'in_progress', label: 'In progress',  count: totals.in_progress },
    { key: 'completed',   label: 'Completed',    count: totals.completed },
    { key: 'dismissed',   label: 'Dismissed',    count: totals.dismissed },
    { key: 'all',         label: 'All',          count: data.items.length },
  ];

  return (
    <div className="space-y-5">
      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Open',        count: totals.open,        style: 'text-amber-400' },
          { label: 'In progress', count: totals.in_progress, style: 'text-sky-400' },
          { label: 'Completed',   count: totals.completed,   style: 'text-emerald-400' },
          { label: 'Dismissed',   count: totals.dismissed,   style: 'text-white/35' },
        ].map(({ label, count, style }) => (
          <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
            <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${style}`}>{count}</p>
          </div>
        ))}
      </div>

      {/* Filter + add */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
          {filterButtons.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                filter === key
                  ? 'bg-white/10 text-white'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {label}{count > 0 && <span className="ml-1 text-white/30">{count}</span>}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <AddImprovementForm onAdded={() => void load()} />
        </div>
      </div>

      {/* Items */}
      {visible.length === 0 ? (
        <p className="text-sm text-white/35">No improvements in this filter.</p>
      ) : (
        <div className="space-y-3">
          {visible.map(item => (
            <ImprovementCard
              key={item.id}
              item={item}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
