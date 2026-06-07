'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { dashboardTheme } from '@/lib/design-system/themes';
import type { JournalEntry } from '@/types/journal';

// ─── Types ────────────────────────────────────────────────────────────────────

type SuggestionType = 'story_bible' | 'character_timeline' | 'arc' | 'open_thread';
type SuggestionStatus = 'pending' | 'applied' | 'skipped';

interface ArcOption      { id: string; title: string; status: string; }
interface ThreadOption   { id: string; title: string; }
interface CharOption     { id: string; name: string; consent_status: string | null; }

// ─── Constants ────────────────────────────────────────────────────────────────

const BIBLE_SECTIONS = [
  { key: 'current_narrative_notes', label: 'Current Narrative Notes' },
  { key: 'mission_purpose',         label: 'Mission & Purpose' },
  { key: 'core_tension',            label: 'Core Tension' },
  { key: 'narrative_tone',          label: 'Narrative Tone' },
  { key: 'the_long_arc',            label: 'The Long Arc' },
  { key: 'what_we_show',            label: 'What We Show' },
  { key: 'what_we_never_do',        label: 'What We Never Do' },
] as const;

const META: Record<SuggestionType, { title: string; hint: string; applyLabel: string; targetLabel: string }> = {
  story_bible:        { title: 'Story Bible Note',          hint: 'Appends to the selected bible section.',          applyLabel: 'Apply to Bible',     targetLabel: 'Section' },
  character_timeline: { title: 'Character Timeline Entry',  hint: 'Appends to the character\'s timeline notes.',    applyLabel: 'Apply to Character', targetLabel: 'Character' },
  arc:                { title: 'Arc Progress Update',       hint: 'Appends to the arc\'s progress notes.',          applyLabel: 'Apply to Arc',       targetLabel: 'Story Arc' },
  open_thread:        { title: 'Open Thread Update',        hint: 'Appends to the thread\'s progress notes.',       applyLabel: 'Apply to Thread',    targetLabel: 'Open Thread' },
};

const STATUS_STYLE: Record<SuggestionStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#F1F5F9', fg: '#64748B', label: 'Pending' },
  applied: { bg: '#ECFDF5', fg: '#047857', label: 'Applied' },
  skipped: { bg: '#F8FAFC', fg: '#94A3B8', label: 'Skipped' },
};

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SuggestionStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  );
}

// ─── Suggestion card ──────────────────────────────────────────────────────────

interface CardProps {
  type:          SuggestionType;
  entryId:       string;
  initialText:   string;
  initialStatus: SuggestionStatus;
  arcs:          ArcOption[];
  threads:       ThreadOption[];
  characters:    CharOption[];
}

function SuggestionCard({
  type, entryId, initialText, initialStatus, arcs, threads, characters,
}: CardProps) {
  const [status, setStatus]   = useState<SuggestionStatus>(initialStatus);
  const [text, setText]       = useState(initialText);
  const [arcId, setArcId]     = useState(() => arcs[0]?.id ?? '');
  const [threadId, setThreadId] = useState(() => threads[0]?.id ?? '');
  const [charId, setCharId]   = useState(() => characters[0]?.id ?? '');
  const [sectionKey, setSectionKey] = useState<string>('current_narrative_notes');
  const [busy, setBusy]       = useState(false);

  const meta       = META[type];
  const isResolved = status === 'applied' || status === 'skipped';

  // Silvan consent note — only when Silvan is selected on the character card
  const selectedChar = characters.find(c => c.id === charId);
  const showConsentNote =
    type === 'character_timeline' &&
    selectedChar?.name === 'Silvan' &&
    selectedChar.consent_status === 'granted';

  // Disable apply when there is no target to write to
  const hasTarget =
    type === 'story_bible'        ? !!sectionKey :
    type === 'character_timeline' ? !!charId :
    type === 'arc'                ? !!arcId :
    !!threadId;

  async function dispatch(action: 'apply' | 'skip') {
    setBusy(true);
    try {
      const payload: Record<string, string> = { suggestion_type: type, action };
      if (action === 'apply') {
        payload.text = text;
        if (type === 'story_bible')        payload.target_section_key = sectionKey;
        else if (type === 'character_timeline') payload.target_id = charId;
        else if (type === 'arc')           payload.target_id = arcId;
        else if (type === 'open_thread')   payload.target_id = threadId;
      }

      const res = await fetch(`/api/journal/${entryId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Request failed');
      }

      const next: SuggestionStatus = action === 'apply' ? 'applied' : 'skipped';
      setStatus(next);
      toast.success(action === 'apply' ? `${meta.title} applied` : `${meta.title} skipped`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const selectClass = 'w-full rounded-xl border px-3 py-2 text-sm bg-white';
  const selectStyle = { borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text };

  return (
    <div className="rounded-[20px] border border-black/5 bg-white/90 p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
            {meta.title}
          </p>
          <p className="mt-0.5 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
            {meta.hint}
          </p>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Editable suggestion text */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        disabled={isResolved}
        placeholder="No suggestion text"
        className="mt-4 w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6 disabled:opacity-50"
        style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
      />

      {/* Target picker — only while pending */}
      {!isResolved && (
        <div className="mt-3">
          <label
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em]"
            style={{ color: dashboardTheme.color.muted }}
          >
            {meta.targetLabel}
          </label>

          {type === 'story_bible' && (
            <select value={sectionKey} onChange={(e) => setSectionKey(e.target.value)} className={selectClass} style={selectStyle}>
              {BIBLE_SECTIONS.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          )}

          {type === 'character_timeline' && (
            <>
              {characters.length === 0
                ? <p className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>No characters found.</p>
                : (
                  <select value={charId} onChange={(e) => setCharId(e.target.value)} className={selectClass} style={selectStyle}>
                    {characters.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )
              }
              {showConsentNote && (
                <p className="mt-1.5 text-[11px]" style={{ color: '#047857' }}>
                  Consent granted. Confirm content respects what_to_show and what_to_protect. Private journal entries must not be quoted directly.
                </p>
              )}
            </>
          )}

          {type === 'arc' && (
            arcs.length === 0
              ? <p className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>No arcs found.</p>
              : (
                <select value={arcId} onChange={(e) => setArcId(e.target.value)} className={selectClass} style={selectStyle}>
                  {arcs.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.status}) — #{a.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              )
          )}

          {type === 'open_thread' && (
            threads.length === 0
              ? <p className="text-[11px]" style={{ color: dashboardTheme.color.muted }}>No open threads found.</p>
              : (
                <select value={threadId} onChange={(e) => setThreadId(e.target.value)} className={selectClass} style={selectStyle}>
                  {threads.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              )
          )}
        </div>
      )}

      {/* Action bar — only while pending */}
      {!isResolved && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => dispatch('skip')}
            disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-slate-50 disabled:opacity-50"
            style={{ color: dashboardTheme.color.muted }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => dispatch('apply')}
            disabled={busy || !text.trim() || !hasTarget}
            className="rounded-xl px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-40"
            style={{ background: dashboardTheme.color.primary }}
          >
            {busy ? 'Applying…' : meta.applyLabel}
          </button>
        </div>
      )}

      {/* Post-resolution confirmation */}
      {isResolved && (
        <p className="mt-3 text-[11px]" style={{ color: status === 'applied' ? '#047857' : '#94A3B8' }}>
          {status === 'applied' ? 'Appended to story system.' : 'Skipped — no changes made.'}
        </p>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface Props {
  entry: JournalEntry;
}

const SUGGESTIONS: Array<{
  type: SuggestionType;
  textKey: keyof JournalEntry;
  statusKey: keyof JournalEntry;
}> = [
  { type: 'story_bible',        textKey: 'suggested_story_bible_note',           statusKey: 'suggestion_story_bible_status' },
  { type: 'character_timeline', textKey: 'suggested_character_timeline_entry',   statusKey: 'suggestion_character_timeline_status' },
  { type: 'arc',                textKey: 'suggested_arc_update',                 statusKey: 'suggestion_arc_status' },
  { type: 'open_thread',        textKey: 'suggested_open_thread_update',         statusKey: 'suggestion_open_thread_status' },
];

export default function SuggestionsApplyPanel({ entry }: Props) {
  const [arcs, setArcs]           = useState<ArcOption[]>([]);
  const [threads, setThreads]     = useState<ThreadOption[]>([]);
  const [characters, setChars]    = useState<CharOption[]>([]);

  const activeSuggestions = SUGGESTIONS.filter(s => {
    const text = entry[s.textKey] as string | null;
    return text?.trim();
  });

  useEffect(() => {
    if (activeSuggestions.length === 0) return;
    Promise.all([
      fetch('/api/story-arcs').then(r => r.json()).catch(() => ({ arcs: [] })),
      fetch('/api/story-threads').then(r => r.json()).catch(() => ({ threads: [] })),
      fetch('/api/story-characters').then(r => r.json()).catch(() => ({ characters: [] })),
    ]).then(([a, t, c]) => {
      setArcs((a as { arcs: ArcOption[] }).arcs ?? []);
      setThreads((t as { threads: ThreadOption[] }).threads ?? []);
      setChars((c as { characters: CharOption[] }).characters ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  if (activeSuggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Section header */}
      <div className="px-1">
        <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
          Story Suggestions
        </p>
        <p className="mt-1 text-xs leading-5" style={{ color: dashboardTheme.color.muted }}>
          AI-generated suggestions from this journal entry. Edit the text if needed, pick a target,
          then apply or skip. Applying appends to the target — nothing is published automatically.
          Private journal details must not be quoted directly in any public content.
        </p>
      </div>

      {activeSuggestions.map(s => (
        <SuggestionCard
          key={s.type}
          type={s.type}
          entryId={entry.id}
          initialText={(entry[s.textKey] as string | null) ?? ''}
          initialStatus={(entry[s.statusKey] as SuggestionStatus | null) ?? 'pending'}
          arcs={arcs}
          threads={threads}
          characters={characters}
        />
      ))}
    </div>
  );
}
