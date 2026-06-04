'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  ARC_STATUS_STYLES,
  ARC_STATUSES,
  type ArcStatus,
  type StoryArc,
} from '@/types/story-engine';

const CHARACTER_OPTIONS = ['Jackson Taylor', 'Silvan', 'Buds At Work'];

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

type ArcDraft = {
  title: string;
  description: string;
  status: ArcStatus;
  start_date: string;
  end_date: string;
  priority: number;
  characters_involved: string[];
  progress_notes: string;
};

function emptyDraft(): ArcDraft {
  return {
    title: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    priority: 0,
    characters_involved: [],
    progress_notes: '',
  };
}

function arcToDraft(arc: StoryArc): ArcDraft {
  return {
    title:               arc.title,
    description:         arc.description,
    status:              arc.status,
    start_date:          arc.start_date ?? '',
    end_date:            arc.end_date ?? '',
    priority:            arc.priority,
    characters_involved: arc.characters_involved,
    progress_notes:      arc.progress_notes,
  };
}

// Active → Planted → Resolved → Abandoned
const STATUS_ORDER: ArcStatus[] = ['active', 'planted', 'resolved', 'abandoned'];

export default function StoryArcsPage() {
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/story-arcs');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setArcs(json.arcs ?? []);
    } catch {
      setError('Could not load arcs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function upsertArc(updated: StoryArc) {
    setArcs((prev) => {
      const exists = prev.some((a) => a.id === updated.id);
      return exists ? prev.map((a) => a.id === updated.id ? updated : a) : [updated, ...prev];
    });
  }

  function removeArc(id: string) {
    setArcs((prev) => prev.filter((a) => a.id !== id));
  }

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    arcs: arcs.filter((a) => a.status === status).sort((a, b) => a.priority - b.priority),
  })).filter((g) => g.arcs.length > 0 || g.status === 'active');

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Story Arcs"
        description="Long-running narrative threads. Each arc has a beginning, a dramatic question, and a resolution condition. Manual management only."
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: dashboardTheme.color.primary }}
          >
            + New Arc
          </button>
        }
      />

      {creating && (
        <ArcForm
          mode="new"
          onSaved={(arc) => { upsertArc(arc); setCreating(false); }}
          onCancel={() => setCreating(false)}
        />
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[24px] border border-black/5 bg-white/90 px-6 py-16 text-center">
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>Loading…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ status, arcs: groupArcs }) => (
            <div key={status}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: ARC_STATUS_STYLES[status].bg, color: ARC_STATUS_STYLES[status].fg }}
                >
                  {ARC_STATUS_STYLES[status].label}
                </span>
                <span className="text-xs" style={{ color: dashboardTheme.color.muted }}>
                  {groupArcs.length} {groupArcs.length === 1 ? 'arc' : 'arcs'}
                </span>
              </div>
              {groupArcs.length === 0 ? (
                <div
                  className="rounded-[24px] border-2 border-dashed px-6 py-8 text-center"
                  style={{ borderColor: 'rgba(15,61,46,0.10)' }}
                >
                  <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>No active arcs yet.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {groupArcs.map((arc) => (
                    <ArcCard key={arc.id} arc={arc} onSaved={upsertArc} onDeleted={removeArc} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Arc card ─────────────────────────────────────────────────────────────────

function ArcCard({
  arc,
  onSaved,
  onDeleted,
}: {
  arc: StoryArc;
  onSaved: (a: StoryArc) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const style = ARC_STATUS_STYLES[arc.status];

  if (editing) {
    return (
      <ArcForm
        mode="edit"
        initial={arc}
        onSaved={(saved) => { onSaved(saved); setEditing(false); }}
        onCancel={() => setEditing(false)}
        onDeleted={() => onDeleted(arc.id)}
      />
    );
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
                {arc.title}
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: style.bg, color: style.fg }}
              >
                {style.label}
              </span>
            </div>
            {!expanded && arc.description && (
              <p className="mt-1 text-sm truncate" style={{ color: dashboardTheme.color.muted }}>
                {arc.description}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs" style={{ color: dashboardTheme.color.muted }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/5 px-5 pb-5 pt-4">
          {arc.description && (
            <p className="text-sm leading-6 mb-4" style={{ color: dashboardTheme.color.text }}>
              {arc.description}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {arc.characters_involved.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: dashboardTheme.color.muted }}>
                  Characters
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {arc.characters_involved.map((c) => (
                    <span key={c} className="rounded-full border px-2.5 py-1 text-[11px]"
                      style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4">
              {arc.start_date && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Started</p>
                  <p className="text-sm" style={{ color: dashboardTheme.color.text }}>{formatDate(arc.start_date)}</p>
                </div>
              )}
              {arc.end_date && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Ends</p>
                  <p className="text-sm" style={{ color: dashboardTheme.color.text }}>{formatDate(arc.end_date)}</p>
                </div>
              )}
            </div>
          </div>

          {arc.progress_notes && (
            <div className="mt-4 rounded-xl px-4 py-3" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1.5" style={{ color: dashboardTheme.color.muted }}>
                Progress Notes
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: dashboardTheme.color.text }}>
                {arc.progress_notes}
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
              Updated {formatTimestamp(arc.updated_at)}
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Edit arc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Arc form (new + edit) ────────────────────────────────────────────────────

function ArcForm({
  mode,
  initial,
  onSaved,
  onCancel,
  onDeleted,
}: {
  mode: 'new' | 'edit';
  initial?: StoryArc;
  onSaved: (a: StoryArc) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<ArcDraft>(() => initial ? arcToDraft(initial) : emptyDraft());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof ArcDraft>(key: K, value: ArcDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleCharacter(char: string) {
    setDraft((d) => ({
      ...d,
      characters_involved: d.characters_involved.includes(char)
        ? d.characters_involved.filter((c) => c !== char)
        : [...d.characters_involved, char],
    }));
  }

  async function save() {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        start_date:  draft.start_date || null,
        end_date:    draft.end_date || null,
      };
      const url = mode === 'new' ? '/api/story-arcs' : `/api/story-arcs/${initial!.id}`;
      const method = mode === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryArc = await res.json();
      onSaved(saved);
      toast.success(mode === 'new' ? 'Arc created' : 'Arc saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteArc() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this arc? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/story-arcs/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Arc deleted');
      onDeleted?.();
    } catch {
      toast.error('Failed to delete arc');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-black/8 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <p className="mb-4 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        {mode === 'new' ? 'New Story Arc' : `Editing: ${initial?.title}`}
      </p>

      <div className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Title *</label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Arc title…"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            autoFocus={mode === 'new'}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Description</label>
          <textarea
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder="What is this arc about? What is the central question?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Status + Priority */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Status</label>
            <div className="flex flex-wrap gap-1.5">
              {ARC_STATUSES.map((s) => {
                const st = ARC_STATUS_STYLES[s];
                const isActive = draft.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => update('status', s)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                    style={isActive
                      ? { background: st.bg, color: st.fg, boxShadow: `inset 0 0 0 1.5px ${st.fg}` }
                      : { background: '#F8FAFC', color: '#94A3B8' }}
                  >
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Priority (lower = higher)</label>
            <input
              type="number"
              value={draft.priority}
              onChange={(e) => update('priority', Number(e.target.value))}
              min={0}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
        </div>

        {/* Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Start Date</label>
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => update('start_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>End Date</label>
            <input
              type="date"
              value={draft.end_date}
              onChange={(e) => update('end_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
        </div>

        {/* Characters */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Characters Involved</label>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_OPTIONS.map((c) => {
              const isOn = draft.characters_involved.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCharacter(c)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={isOn
                    ? { background: '#ECFDF5', borderColor: '#10B981', color: '#047857' }
                    : { borderColor: 'rgba(15,61,46,0.15)', color: dashboardTheme.color.muted }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Progress notes */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Current Progress Notes</label>
          <textarea
            value={draft.progress_notes}
            onChange={(e) => update('progress_notes', e.target.value)}
            rows={4}
            placeholder="Where is this arc right now? What has happened recently? What is the next beat?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            Cancel
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={deleteArc}
              disabled={deleting || saving}
              className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-red-50"
              style={{ color: '#B91C1C' }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: dashboardTheme.color.primary }}
        >
          {saving ? 'Saving…' : mode === 'new' ? 'Create Arc' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
