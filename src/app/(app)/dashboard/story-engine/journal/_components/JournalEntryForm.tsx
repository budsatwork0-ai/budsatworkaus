'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  JOURNAL_SECTIONS,
  CONTENT_POTENTIAL_LABELS,
  CONTENT_POTENTIAL_STYLES,
  type JournalEntry,
  type JournalEntryDraft,
  type ContentPotentialRating,
} from '@/types/journal';

type Props = {
  mode: 'new' | 'edit';
  initial?: JournalEntry;
};

const ALL_RATINGS: ContentPotentialRating[] = ['none', 'low', 'medium', 'high'];

function todayDate() {
  return new Date().toLocaleDateString('en-CA');
}

function buildDraft(initial?: JournalEntry): JournalEntryDraft {
  return {
    entry_date:               initial?.entry_date ?? todayDate(),
    wins:                     initial?.wins ?? '',
    challenges:               initial?.challenges ?? '',
    customer_activity:        initial?.customer_activity ?? '',
    silvan_updates:           initial?.silvan_updates ?? '',
    business_progress:        initial?.business_progress ?? '',
    bud_os_progress:          initial?.bud_os_progress ?? '',
    memorable_moments:        initial?.memorable_moments ?? '',
    lessons_learned:          initial?.lessons_learned ?? '',
    content_potential_notes:  initial?.content_potential_notes ?? '',
    media_references:         initial?.media_references ?? '',
    tags:                     initial?.tags ?? [],
    content_potential_rating: initial?.content_potential_rating ?? 'none',
    arc_connections:          initial?.arc_connections ?? [],
  };
}

export default function JournalEntryForm({ mode, initial }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<JournalEntryDraft>(() => buildDraft(initial));
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof JournalEntryDraft>(key: K, value: JournalEntryDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (!t || draft.tags.includes(t)) { setTagInput(''); return; }
    update('tags', [...draft.tags, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    update('tags', draft.tags.filter((t) => t !== tag));
  }

  async function save() {
    if (!draft.entry_date) { toast.error('Please set an entry date'); return; }
    setSaving(true);
    try {
      const url = mode === 'new' ? '/api/journal' : `/api/journal/${initial!.id}`;
      const method = mode === 'new' ? 'POST' : 'PUT';

      // Normalise: convert empty strings to null for text fields
      const payload: Partial<JournalEntryDraft> = { ...draft };
      for (const section of JOURNAL_SECTIONS) {
        const k = section.key as keyof JournalEntryDraft;
        if (typeof payload[k] === 'string' && !(payload[k] as string).trim()) {
          (payload as Record<string, unknown>)[k] = null;
        }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }

      const saved = await res.json();
      toast.success(mode === 'new' ? 'Entry saved' : 'Entry updated');
      if (mode === 'new') {
        router.push(`/dashboard/story-engine/journal/${saved.id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/journal/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Entry deleted');
      router.push('/dashboard/story-engine/journal');
    } catch {
      toast.error('Failed to delete entry');
    } finally {
      setDeleting(false);
    }
  }

  const ratingStyle = CONTENT_POTENTIAL_STYLES[draft.content_potential_rating];

  return (
    <div className="flex flex-col gap-6">
      {/* Date + metadata row */}
      <div className="rounded-[20px] border border-black/5 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Entry Date
            </label>
            <input
              type="date"
              value={draft.entry_date}
              onChange={(e) => update('entry_date', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm font-medium"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Content Potential
            </label>
            <div className="flex gap-1.5">
              {ALL_RATINGS.map((r) => {
                const s = CONTENT_POTENTIAL_STYLES[r];
                const isActive = draft.content_potential_rating === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => update('content_potential_rating', r)}
                    className="flex-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition"
                    style={isActive
                      ? { background: s.bg, color: s.fg, boxShadow: `inset 0 0 0 1.5px ${s.fg}` }
                      : { background: '#F8FAFC', color: '#94A3B8' }
                    }
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                );
              })}
            </div>
            {draft.content_potential_rating !== 'none' && (
              <p className="mt-1.5 text-[11px]" style={{ color: ratingStyle.fg }}>
                {CONTENT_POTENTIAL_LABELS[draft.content_potential_rating]}
              </p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="mt-4">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Tags
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              placeholder="Add tag and press Enter"
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
            <button
              type="button"
              onClick={addTag}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Add
            </button>
          </div>
          {draft.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => removeTag(t)}
                  className="rounded-full border px-2.5 py-1 text-[11px] transition hover:border-red-200 hover:bg-red-50"
                  style={{ borderColor: 'rgba(15,61,46,0.15)', color: dashboardTheme.color.muted }}
                  title="Remove tag"
                >
                  {t} ×
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 10 journal sections */}
      {JOURNAL_SECTIONS.map((section) => {
        const value = (draft[section.key as keyof JournalEntryDraft] as string | null) ?? '';
        return (
          <div
            key={section.key}
            className="rounded-[20px] border border-black/5 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
          >
            <label
              className="block text-sm font-semibold mb-2"
              style={{ color: dashboardTheme.color.primary }}
            >
              {section.label}
            </label>
            <textarea
              value={value}
              onChange={(e) => update(section.key as keyof JournalEntryDraft, e.target.value as never)}
              rows={section.rows}
              placeholder={section.placeholder}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            />
          </div>
        );
      })}

      {/* Action bar */}
      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-[20px] border border-black/5 bg-white/95 px-5 py-4 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard/story-engine/journal')}
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            ← Back
          </button>
          {mode === 'edit' && (
            <button
              type="button"
              onClick={deleteEntry}
              disabled={deleting}
              className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-red-50"
              style={{ color: '#B91C1C' }}
            >
              {deleting ? 'Deleting…' : 'Delete entry'}
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
          {saving ? 'Saving…' : mode === 'new' ? 'Save entry' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
