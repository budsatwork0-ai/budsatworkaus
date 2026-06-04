'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import type { StoryChapter } from '@/types/story-engine';

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

type ChapterDraft = {
  title: string;
  summary: string;
  goal: string;
  started_at: string;
  ended_at: string;
};

function chapterToDraft(c: StoryChapter): ChapterDraft {
  return {
    title:      c.title,
    summary:    c.summary,
    goal:       c.goal,
    started_at: c.started_at ?? '',
    ended_at:   c.ended_at ?? '',
  };
}

export default function CurrentChapterPage() {
  const [chapter, setChapter] = useState<StoryChapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ChapterDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/story-chapter');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setChapter(json.active ?? null);
    } catch {
      setError('Could not load chapter.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit() {
    if (chapter) {
      setDraft(chapterToDraft(chapter));
      setEditing(true);
    }
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function updateDraft<K extends keyof ChapterDraft>(key: K, value: ChapterDraft[K]) {
    setDraft((d) => d ? { ...d, [key]: value } : d);
  }

  async function save() {
    if (!draft || !chapter) return;
    if (!draft.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/story-chapter/${chapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:      draft.title,
          summary:    draft.summary,
          goal:       draft.goal,
          started_at: draft.started_at || null,
          ended_at:   draft.ended_at || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryChapter = await res.json();
      setChapter(saved);
      setEditing(false);
      setDraft(null);
      toast.success('Chapter saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Current Chapter"
        description="The named, bounded narrative period we are living in right now. One active chapter at a time. Manual editing only."
      />

      <RulesNote />

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-[24px] border border-black/5 bg-white/90 px-6 py-16 text-center">
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>Loading…</p>
        </div>
      ) : !chapter ? (
        <div className="rounded-[24px] border border-black/5 bg-white/90 px-6 py-16 text-center">
          <p className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>No active chapter</p>
          <p className="mt-2 text-sm" style={{ color: dashboardTheme.color.muted }}>No chapter is currently set as active.</p>
        </div>
      ) : editing && draft ? (
        <ChapterEditForm
          draft={draft}
          saving={saving}
          onChange={updateDraft}
          onSave={save}
          onCancel={cancelEdit}
        />
      ) : (
        <ChapterView chapter={chapter} onEdit={startEdit} />
      )}
    </div>
  );
}

// ─── Chapter view ─────────────────────────────────────────────────────────────

function ChapterView({ chapter, onEdit }: { chapter: StoryChapter; onEdit: () => void }) {
  return (
    <div className="rounded-[28px] border border-black/5 bg-white/90 overflow-hidden shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      {/* Header band */}
      <div
        className="px-6 py-6"
        style={{ background: 'linear-gradient(135deg, #F0FDF4, #ECFDF5)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#047857' }}>
              Active Chapter
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]" style={{ color: dashboardTheme.color.primary }}>
              {chapter.title}
            </h2>
            {chapter.started_at && (
              <p className="mt-1 text-sm" style={{ color: '#047857' }}>
                Started {formatDate(chapter.started_at)}
                {chapter.ended_at && ` · Ends ${formatDate(chapter.ended_at)}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-white/80"
            style={{ background: 'rgba(255,255,255,0.6)', color: dashboardTheme.color.muted }}
          >
            Edit chapter
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {/* Summary */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: dashboardTheme.color.muted }}>
            Chapter Summary
          </p>
          {chapter.summary ? (
            <div className="rounded-xl px-4 py-4" style={{ background: '#F8FAFC' }}>
              <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: dashboardTheme.color.text }}>
                {chapter.summary}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed px-4 py-6 text-center" style={{ borderColor: 'rgba(15,61,46,0.12)' }}>
              <p className="text-sm italic" style={{ color: dashboardTheme.color.muted, opacity: 0.6 }}>No summary written yet.</p>
            </div>
          )}
        </div>

        {/* Goal */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-2" style={{ color: dashboardTheme.color.muted }}>
            Chapter Goal
          </p>
          {chapter.goal ? (
            <div
              className="rounded-xl border px-4 py-3"
              style={{ background: '#ECFDF5', borderColor: 'rgba(16,185,129,0.2)' }}
            >
              <p className="text-sm font-medium leading-6" style={{ color: '#065F46' }}>
                {chapter.goal}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed px-4 py-4 text-center" style={{ borderColor: 'rgba(15,61,46,0.12)' }}>
              <p className="text-sm italic" style={{ color: dashboardTheme.color.muted, opacity: 0.6 }}>No goal set.</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-black/5 px-6 py-3">
        <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
          Last updated {formatTimestamp(chapter.updated_at)} · Owner: Jackson Taylor — no AI edits
        </p>
      </div>
    </div>
  );
}

// ─── Chapter edit form ────────────────────────────────────────────────────────

function ChapterEditForm({
  draft,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  draft: ChapterDraft;
  saving: boolean;
  onChange: <K extends keyof ChapterDraft>(key: K, value: ChapterDraft[K]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-[24px] border-2 border-black/8 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <p className="mb-4 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        Editing current chapter
      </p>

      <div className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Chapter Title *
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange('title', e.target.value)}
            autoFocus
            className="w-full rounded-xl border px-3 py-2 text-sm font-medium"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Summary */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Chapter Summary
          </label>
          <textarea
            value={draft.summary}
            onChange={(e) => onChange('summary', e.target.value)}
            rows={6}
            placeholder="Where is the business right now? What has happened that defines this chapter? What season are we in?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Goal */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Chapter Goal
          </label>
          <textarea
            value={draft.goal}
            onChange={(e) => onChange('goal', e.target.value)}
            rows={3}
            placeholder="What does success look like at the end of this chapter?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Started
            </label>
            <input
              type="date"
              value={draft.started_at}
              onChange={(e) => onChange('started_at', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Ends (optional)
            </label>
            <input
              type="date"
              value={draft.ended_at}
              onChange={(e) => onChange('ended_at', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl px-4 py-2 text-sm font-medium"
          style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: dashboardTheme.color.primary }}
        >
          {saving ? 'Saving…' : 'Save chapter'}
        </button>
      </div>
    </div>
  );
}

// ─── Rules note ───────────────────────────────────────────────────────────────

function RulesNote() {
  return (
    <div
      className="rounded-[20px] border px-4 py-3"
      style={{ background: '#F0FDF4', borderColor: 'rgba(16,185,129,0.2)' }}
    >
      <p className="text-[11px] font-semibold" style={{ color: '#065F46' }}>
        One active chapter at a time · Manual editing only · No AI edits
      </p>
      <p className="mt-1 text-xs" style={{ color: '#047857' }}>
        Owner: Jackson Taylor. The chapter defines the current season of the story.
      </p>
    </div>
  );
}
