'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  THREAD_STATUS_STYLES,
  THREAD_STATUSES,
  type StoryOpenThread,
  type ThreadStatus,
  type StoryArc,
} from '@/types/story-engine';

const CHARACTER_OPTIONS = ['Jackson Taylor', 'Silvan', 'Buds At Work'];

function formatDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function daysOpen(openedDate: string) {
  const diff = Date.now() - new Date(openedDate + 'T12:00:00').getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

type ThreadDraft = {
  title: string;
  description: string;
  related_arc_id: string;
  related_characters: string[];
  opened_date: string;
};

function emptyDraft(): ThreadDraft {
  return {
    title: '',
    description: '',
    related_arc_id: '',
    opened_date: new Date().toISOString().slice(0, 10),
    related_characters: [],
  };
}

export default function OpenThreadsPage() {
  const [threads, setThreads] = useState<StoryOpenThread[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [tRes, aRes] = await Promise.all([
        fetch('/api/story-threads'),
        fetch('/api/story-arcs'),
      ]);
      if (!tRes.ok) throw new Error('Failed to load threads');
      const [tj, aj] = await Promise.all([tRes.json(), aRes.json()]);
      setThreads(tj.threads ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load threads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function upsertThread(updated: StoryOpenThread) {
    setThreads((prev) => {
      const exists = prev.some((t) => t.id === updated.id);
      return exists ? prev.map((t) => t.id === updated.id ? updated : t) : [updated, ...prev];
    });
  }

  const open = threads.filter((t) => t.status === 'open').sort(
    (a, b) => new Date(a.opened_date).getTime() - new Date(b.opened_date).getTime(),
  );
  const closed = threads.filter((t) => t.status !== 'open').sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Open Threads"
        description="Unresolved story questions — narrative promises with no conclusion yet. Track them here until they close."
        actions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: dashboardTheme.color.primary }}
          >
            + New Thread
          </button>
        }
      />

      {creating && (
        <NewThreadForm
          arcs={arcs}
          onSaved={(t) => { upsertThread(t); setCreating(false); }}
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
          {/* Open threads */}
          <div>
            <div className="mb-3 flex items-center gap-2 px-1">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: THREAD_STATUS_STYLES.open.bg, color: THREAD_STATUS_STYLES.open.fg }}
              >
                Open
              </span>
              <span className="text-xs" style={{ color: dashboardTheme.color.muted }}>
                {open.length} {open.length === 1 ? 'thread' : 'threads'}
              </span>
            </div>
            {open.length === 0 ? (
              <div className="rounded-[24px] border-2 border-dashed px-6 py-8 text-center" style={{ borderColor: 'rgba(15,61,46,0.10)' }}>
                <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>No open threads.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {open.map((thread) => (
                  <ThreadCard key={thread.id} thread={thread} arcs={arcs} onSaved={upsertThread} />
                ))}
              </div>
            )}
          </div>

          {/* Closed threads */}
          {closed.length > 0 && (
            <div>
              <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: dashboardTheme.color.muted }}>
                Closed ({closed.length})
              </p>
              <div className="flex flex-col gap-3">
                {closed.map((thread) => (
                  <ThreadCard key={thread.id} thread={thread} arcs={arcs} onSaved={upsertThread} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Thread card ──────────────────────────────────────────────────────────────

function ThreadCard({
  thread,
  arcs,
  onSaved,
}: {
  thread: StoryOpenThread;
  arcs: StoryArc[];
  onSaved: (t: StoryOpenThread) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const style = THREAD_STATUS_STYLES[thread.status];
  const relatedArc = arcs.find((a) => a.id === thread.related_arc_id);
  const age = daysOpen(thread.opened_date);

  async function quickClose(status: 'resolved' | 'abandoned') {
    setSaving(true);
    try {
      const res = await fetch(`/api/story-threads/${thread.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          closed_date: new Date().toISOString().slice(0, 10),
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved: StoryOpenThread = await res.json();
      onSaved(saved);
      toast.success(status === 'resolved' ? 'Thread resolved' : 'Thread abandoned');
    } catch {
      toast.error('Failed to update thread');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <ThreadEditForm
        thread={thread}
        arcs={arcs}
        onSaved={(saved) => { onSaved(saved); setEditing(false); }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
              {thread.title}
            </h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: style.bg, color: style.fg }}
            >
              {style.label}
            </span>
            {thread.status === 'open' && (
              <span className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {age === 0 ? 'Opened today' : `${age}d open`}
              </span>
            )}
          </div>
          {thread.description && (
            <p className="mt-1 text-sm leading-6" style={{ color: dashboardTheme.color.muted }}>
              {thread.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {relatedArc && (
              <span className="text-[11px] rounded-full border px-2.5 py-1"
                style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
                ↳ {relatedArc.title}
              </span>
            )}
            {thread.related_characters.map((c) => (
              <span key={c} className="text-[11px] rounded-full border px-2.5 py-1"
                style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            Edit
          </button>
          {thread.status === 'open' && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => quickClose('resolved')}
                disabled={saving}
                className="rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition hover:opacity-90"
                style={{ background: '#ECFDF5', color: '#047857' }}
              >
                Resolve
              </button>
              <button
                type="button"
                onClick={() => quickClose('abandoned')}
                disabled={saving}
                className="rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition hover:bg-slate-100"
                style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
              >
                Abandon
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 border-t border-black/5 pt-3 flex items-center justify-between">
        <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
          Opened {formatDate(thread.opened_date)}
          {thread.closed_date && ` · Closed ${formatDate(thread.closed_date)}`}
        </p>
      </div>
    </div>
  );
}

// ─── Thread edit form ─────────────────────────────────────────────────────────

function ThreadEditForm({
  thread,
  arcs,
  onSaved,
  onCancel,
}: {
  thread: StoryOpenThread;
  arcs: StoryArc[];
  onSaved: (t: StoryOpenThread) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    title:              thread.title,
    description:        thread.description,
    related_arc_id:     thread.related_arc_id ?? '',
    related_characters: thread.related_characters,
    status:             thread.status,
    opened_date:        thread.opened_date,
    closed_date:        thread.closed_date ?? '',
  });
  const [saving, setSaving] = useState(false);

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleCharacter(c: string) {
    setDraft((d) => ({
      ...d,
      related_characters: d.related_characters.includes(c)
        ? d.related_characters.filter((x) => x !== c)
        : [...d.related_characters, c],
    }));
  }

  async function save() {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/story-threads/${thread.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          related_arc_id: draft.related_arc_id || null,
          closed_date:    draft.closed_date || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryOpenThread = await res.json();
      onSaved(saved);
      toast.success('Thread saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-black/8 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <p className="mb-4 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        Editing thread
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Title *</label>
          <input type="text" value={draft.title} onChange={(e) => update('title', e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Description</label>
          <textarea value={draft.description} onChange={(e) => update('description', e.target.value)}
            rows={3} className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Status</label>
            <div className="flex flex-wrap gap-1.5">
              {THREAD_STATUSES.map((s) => {
                const st = THREAD_STATUS_STYLES[s];
                const isOn = draft.status === s;
                return (
                  <button key={s} type="button" onClick={() => update('status', s)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                    style={isOn ? { background: st.bg, color: st.fg, boxShadow: `inset 0 0 0 1.5px ${st.fg}` } : { background: '#F8FAFC', color: '#94A3B8' }}>
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Related Arc</label>
            <select value={draft.related_arc_id} onChange={(e) => update('related_arc_id', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: draft.related_arc_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}>
              <option value="">None</option>
              {arcs.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Characters</label>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_OPTIONS.map((c) => {
              const isOn = draft.related_characters.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCharacter(c)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={isOn ? { background: '#ECFDF5', borderColor: '#10B981', color: '#047857' } : { borderColor: 'rgba(15,61,46,0.15)', color: dashboardTheme.color.muted }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Opened Date</label>
            <input type="date" value={draft.opened_date} onChange={(e) => update('opened_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Closed Date</label>
            <input type="date" value={draft.closed_date} onChange={(e) => update('closed_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: dashboardTheme.color.primary }}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ─── New thread form ──────────────────────────────────────────────────────────

function NewThreadForm({
  arcs,
  onSaved,
  onCancel,
}: {
  arcs: StoryArc[];
  onSaved: (t: StoryOpenThread) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ThreadDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ThreadDraft>(key: K, value: ThreadDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function toggleCharacter(c: string) {
    setDraft((d) => ({
      ...d,
      related_characters: d.related_characters.includes(c)
        ? d.related_characters.filter((x) => x !== c)
        : [...d.related_characters, c],
    }));
  }

  async function save() {
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/story-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, related_arc_id: draft.related_arc_id || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryOpenThread = await res.json();
      onSaved(saved);
      toast.success('Thread opened');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create thread');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-black/8 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <p className="mb-4 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        Open New Thread
      </p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Title *</label>
          <input type="text" value={draft.title} onChange={(e) => update('title', e.target.value)}
            placeholder="What question is this thread asking?"
            autoFocus
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Description</label>
          <textarea value={draft.description} onChange={(e) => update('description', e.target.value)}
            rows={3} placeholder="What does resolution look like? Why does this thread matter?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Related Arc</label>
            <select value={draft.related_arc_id} onChange={(e) => update('related_arc_id', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: draft.related_arc_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}>
              <option value="">None</option>
              {arcs.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Opened Date</label>
            <input type="date" value={draft.opened_date} onChange={(e) => update('opened_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Characters</label>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_OPTIONS.map((c) => {
              const isOn = draft.related_characters.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCharacter(c)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={isOn ? { background: '#ECFDF5', borderColor: '#10B981', color: '#047857' } : { borderColor: 'rgba(15,61,46,0.15)', color: dashboardTheme.color.muted }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
        <button type="button" onClick={onCancel} disabled={saving}
          className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: dashboardTheme.color.primary }}>
          {saving ? 'Opening…' : 'Open Thread'}
        </button>
      </div>
    </div>
  );
}
