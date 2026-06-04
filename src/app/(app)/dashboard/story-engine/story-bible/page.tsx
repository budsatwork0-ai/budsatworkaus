'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import { STORY_BIBLE_SECTIONS, type StoryBibleSection, type StoryBibleSectionKey } from '@/types/story-engine';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function StoryBiblePage() {
  const [sections, setSections] = useState<StoryBibleSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/story-bible');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setSections(json.sections ?? []);
    } catch {
      setError('Could not load Story Bible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function getSectionData(key: StoryBibleSectionKey): StoryBibleSection | undefined {
    return sections.find((s) => s.section_key === key);
  }

  function updateSection(updated: StoryBibleSection) {
    setSections((prev) => prev.map((s) => s.section_key === updated.section_key ? updated : s));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Story Bible"
        description="The manually maintained narrative source of truth for Buds At Work. Defines the mission, tone, constraints, and long arc. Every piece of content reads from this document."
      />

      <ConstitutionNote />
      <NoAINote />

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
        <div className="flex flex-col gap-4">
          {STORY_BIBLE_SECTIONS.map((def) => {
            const row = getSectionData(def.key);
            return (
              <SectionCard
                key={def.key}
                def={def}
                row={row}
                onSaved={updateSection}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

type SectionCardProps = {
  def: (typeof STORY_BIBLE_SECTIONS)[number];
  row: StoryBibleSection | undefined;
  onSaved: (updated: StoryBibleSection) => void;
};

function SectionCard({ def, row, onSaved }: SectionCardProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row?.content ?? '');
  const [saving, setSaving] = useState(false);

  // Keep draft in sync if row loads after initial render
  useEffect(() => {
    if (!editing) setDraft(row?.content ?? '');
  }, [row?.content, editing]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/story-bible/${def.key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryBibleSection = await res.json();
      onSaved(saved);
      setEditing(false);
      toast.success(`${def.title} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(row?.content ?? '');
    setEditing(false);
  }

  const isEmpty = !row?.content?.trim();

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
            {def.title}
          </h2>
          <p className="mt-1 text-sm" style={{ color: dashboardTheme.color.muted }}>
            {def.description}
          </p>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => { setDraft(row?.content ?? ''); setEditing(true); }}
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            {isEmpty ? 'Start writing' : 'Edit'}
          </button>
        )}
      </div>

      {/* Content area */}
      <div className="mt-4">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={def.rows}
              placeholder={def.placeholder}
              className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              autoFocus
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                style={{ background: dashboardTheme.color.primary }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
                style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : isEmpty ? (
          <div
            className="rounded-xl border-2 border-dashed px-4 py-8 text-center"
            style={{ borderColor: 'rgba(15,61,46,0.12)' }}
          >
            <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
              Not written yet. Click <strong>Start writing</strong> to begin.
            </p>
          </div>
        ) : (
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: '#F8FAFC' }}
          >
            <p className="whitespace-pre-wrap text-sm leading-7" style={{ color: dashboardTheme.color.text }}>
              {row!.content}
            </p>
          </div>
        )}
      </div>

      {/* Footer: timestamp */}
      {row && (
        <p className="mt-4 border-t border-black/5 pt-3 text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
          Last updated {formatTimestamp(row.updated_at)} by {row.updated_by}
        </p>
      )}
    </div>
  );
}

// ─── Supplementary notes ──────────────────────────────────────────────────────

function ConstitutionNote() {
  return (
    <div
      className="rounded-[20px] border px-5 py-4"
      style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,0.25)' }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>
        Constitution Reference
      </p>
      <p className="mt-1.5 text-sm leading-6" style={{ color: '#92400E' }}>
        The Story Bible is the source of truth all content reads from. Without it, content has no story grounding.
        Content without story is generic service content. Generic service content does not build an invested audience.
      </p>
      <Link
        href="/dashboard/growth-hq"
        className="mt-2 inline-block text-xs font-mono underline"
        style={{ color: '#B45309', opacity: 0.7 }}
      >
        docs/constitution/growth-marketing-constitution.md § VI, § VIII, § IX
      </Link>
    </div>
  );
}

function NoAINote() {
  return (
    <div
      className="rounded-[20px] border px-4 py-3"
      style={{ background: '#F0FDF4', borderColor: 'rgba(16,185,129,0.2)' }}
    >
      <p className="text-[11px] font-semibold" style={{ color: '#065F46' }}>
        Manual editing only — No AI may write or modify this document.
      </p>
      <p className="mt-1 text-xs" style={{ color: '#047857' }}>
        Owner: Jackson Taylor. Every edit is timestamped.
      </p>
    </div>
  );
}
