'use client';

import React, { useEffect, useState } from 'react';
import type { ObsidianNote, ObsidianResponse } from '@/app/api/bud/obsidian/route';

const SECTION_COLORS: Record<string, string> = {
  'systems':        'border-violet-400/30 bg-violet-500/[0.08] text-violet-300',
  'components':     'border-sky-400/30    bg-sky-500/[0.08]    text-sky-300',
  'refactor-plans': 'border-amber-400/30  bg-amber-500/[0.08]  text-amber-300',
  'claude-memory':  'border-teal-400/30   bg-teal-500/[0.08]   text-teal-300',
};

function NoteCard({ note }: { note: ObsidianNote }) {
  const chipStyle = SECTION_COLORS[note.section] ?? 'border-white/15 bg-white/[0.03] text-white/55';
  const age = new Date(note.updatedAt);
  const ageLabel = age.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-white/[0.10] hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-white/90">{note.title}</h4>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipStyle}`}>
              {note.sectionLabel}
            </span>
          </div>
          {note.preview && (
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45 line-clamp-2">{note.preview}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-white/30">{ageLabel}</p>
          <p className="text-[11px] text-white/20">{note.wordCount}w</p>
        </div>
      </div>
    </div>
  );
}

export function ObsidianTab() {
  const [data, setData] = useState<ObsidianResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('all');

  useEffect(() => {
    setLoading(true);
    fetch('/api/bud/obsidian')
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ available: false, reason: 'Request failed.' }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-white/40">
        Reading architecture vault…
      </div>
    );
  }

  if (!data || !data.available) {
    const reason = (data as { available: false; reason: string } | null)?.reason ?? '';
    const isProduction = reason.includes('bridge') || reason.includes('production');
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center">
        <p className="text-sm font-medium text-white/60">
          {isProduction ? 'Vault not available in production' : 'Architecture vault not found'}
        </p>
        <p className="mt-1 text-xs text-white/35">
          {isProduction
            ? 'Start the local Bud bridge to browse architecture notes here.'
            : reason || 'Vault not found locally.'}
        </p>
      </div>
    );
  }

  const visibleNotes = activeSection === 'all'
    ? data.notes
    : data.notes.filter(n => n.section === activeSection);

  return (
    <div className="space-y-4">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.06] to-indigo-500/[0.03] p-6">
        <div className="pointer-events-none absolute -top-12 right-0 h-40 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-violet-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-300/80">Obsidian · Architecture Memory</span>
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Architecture Vault</h2>
          <p className="mt-1 text-sm text-white/50">
            {data.totalNotes} notes across {data.sections.filter(s => s.count > 0).length} sections
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.sections.filter(s => s.count > 0).map(s => {
              const chipStyle = SECTION_COLORS[s.key] ?? 'border-white/15 bg-white/[0.03] text-white/55';
              return (
                <span key={s.key} className={`rounded-full border px-3 py-1 text-[11px] font-medium ${chipStyle}`}>
                  {s.count} {s.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Section filter ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1.5">
        {[{ key: 'all', label: `All (${data.totalNotes})` }, ...data.sections.filter(s => s.count > 0).map(s => ({ key: s.key, label: `${s.label} (${s.count})` }))].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
              activeSection === key
                ? 'border-white/20 bg-white/[0.08] text-white'
                : 'border-white/[0.06] text-white/45 hover:text-white/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Notes ──────────────────────────────────────────────────────────── */}
      {visibleNotes.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/35">No notes in this section.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleNotes.map(note => (
            <NoteCard key={note.relativePath} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
