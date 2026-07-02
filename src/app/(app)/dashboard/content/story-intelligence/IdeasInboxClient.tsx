'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import {
  type ContentIdea,
  type ContentIdeaStatus,
  CONTENT_IDEA_STATUS_STYLES,
  CONTENT_IDEA_STATUSES,
} from '@/types/content-idea';

// ── Display label map (status → display) ─────────────────────────────────────
const STATUS_DISPLAY: Record<ContentIdeaStatus, string> = {
  captured: 'Idea',
  developed: 'To Create',
  scripted: 'Created',
  archived: 'Skipped',
};

// ── Story opportunity shape (top-level fields only) ───────────────────────────
type StoryOpportunity = {
  id: string;
  title: string;
  story_score: number;
  source_type?: string;
};

// ── Score pill colour ──────────────────────────────────────────────────────────
function scorePillStyle(score: number | null | undefined): { bg: string; fg: string } {
  if (!score) return { bg: '#F8FAFC', fg: '#64748B' };
  if (score > 70) return { bg: '#ECFDF5', fg: '#047857' };
  if (score >= 40) return { bg: '#FFFBEB', fg: '#B45309' };
  return { bg: '#F8FAFC', fg: '#64748B' };
}

// ── Idea card ─────────────────────────────────────────────────────────────────
function IdeaCard({ idea }: { idea: ContentIdea & { idea_score?: number } }) {
  const statusStyle = CONTENT_IDEA_STATUS_STYLES[idea.status];
  const scoreStyle = scorePillStyle(idea.idea_score);
  const displayLabel = STATUS_DISPLAY[idea.status];

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-slate-950">{idea.title}</p>
        {idea.idea_score != null && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums"
            style={{ background: scoreStyle.bg, color: scoreStyle.fg }}
          >
            {idea.idea_score}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: statusStyle.bg, color: statusStyle.fg }}
        >
          {displayLabel}
        </span>
        {idea.platform_fit && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {idea.platform_fit}
          </span>
        )}
      </div>

      {idea.notes && (
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{idea.notes}</p>
      )}

      <div className="mt-4 flex justify-end">
        <Link
          href={`/dashboard/content?idea_id=${idea.id}`}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
          style={{ background: '#EFF6FF', color: brand.accent }}
        >
          Create content →
        </Link>
      </div>
    </div>
  );
}

// ── Quick-add form ─────────────────────────────────────────────────────────────
function QuickAddForm({ onAdded }: { onAdded: (idea: ContentIdea) => void }) {
  const [title, setTitle] = useState('');
  const [platform, setPlatform] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), platform_fit: platform, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add idea');
        return;
      }
      toast.success('Idea added to inbox');
      onAdded(data);
      setTitle('');
      setPlatform('');
      setNotes('');
    } catch {
      toast.error('Failed to add idea');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Quick add</p>
      <div className="mt-3 flex flex-col gap-3">
        <input
          type="text"
          placeholder="Idea title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
        />
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
        >
          <option value="">Platform (optional)</option>
          <option value="Instagram">Instagram</option>
          <option value="TikTok">TikTok</option>
          <option value="Facebook">Facebook</option>
          <option value="Email">Email</option>
          <option value="All">All</option>
        </select>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none resize-none"
        />
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: brand.accent }}
        >
          {loading ? 'Adding...' : 'Add to inbox'}
        </button>
      </div>
    </form>
  );
}

// ── Right panel: Pull from sources ───────────────────────────────────────────
type IdeaResult = ContentIdea & { idea_score?: number };

function SourcesPanel({
  opportunities,
  onAddFromOpp,
}: {
  opportunities: StoryOpportunity[];
  onAddFromOpp: (idea: IdeaResult) => void;
}) {
  const [manualNote, setManualNote] = useState('');
  const [addingManual, setAddingManual] = useState(false);
  const [addingOppId, setAddingOppId] = useState<string | null>(null);

  async function handleAddManual() {
    if (!manualNote.trim()) return;
    setAddingManual(true);
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: manualNote.trim(), notes: manualNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add note');
        return;
      }
      toast.success('Note added to inbox');
      setManualNote('');
      onAddFromOpp(data as IdeaResult);
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingManual(false);
    }
  }

  async function handleAddOpp(opp: StoryOpportunity) {
    setAddingOppId(opp.id);
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: opp.title,
          opportunity_id: opp.id,
          notes: `Added from Story Opportunity (score: ${opp.story_score})`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to add opportunity');
        return;
      }
      toast.success('Opportunity added to inbox');
      onAddFromOpp(data as IdeaResult);
    } catch {
      toast.error('Failed to add opportunity');
    } finally {
      setAddingOppId(null);
    }
  }

  const COMING_SOON = ['Jobs', 'Reviews', 'Fundraising'];

  return (
    <div className="flex flex-col gap-5">
      {/* Story Opportunities */}
      <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Inspiration sources</p>
        <h3 className="mt-2 text-sm font-semibold text-slate-900">Story Opportunities</h3>
        <div className="mt-3 flex flex-col gap-3">
          {opportunities.length === 0 && (
            <p className="text-sm text-slate-400">No open opportunities right now.</p>
          )}
          {opportunities.map((opp) => (
            <div
              key={opp.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-black/5 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{opp.title}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">Score {opp.story_score}</p>
              </div>
              <button
                type="button"
                onClick={() => handleAddOpp(opp)}
                disabled={addingOppId === opp.id}
                className="shrink-0 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
              >
                {addingOppId === opp.id ? '...' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Manual note */}
      <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-sm font-semibold text-slate-900">Manual note</h3>
        <textarea
          placeholder="Jot down a quick content idea..."
          value={manualNote}
          onChange={(e) => setManualNote(e.target.value)}
          rows={3}
          className="mt-3 w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none resize-none"
        />
        <button
          type="button"
          onClick={handleAddManual}
          disabled={addingManual || !manualNote.trim()}
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: brand.accent }}
        >
          {addingManual ? 'Adding...' : 'Add to inbox'}
        </button>
      </div>

      {/* Coming soon stubs */}
      <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <h3 className="text-sm font-semibold text-slate-900">More sources</h3>
        <div className="mt-3 flex flex-col gap-2">
          {COMING_SOON.map((source) => (
            <div
              key={source}
              className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 p-3"
            >
              <p className="text-sm text-slate-500">{source}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Status filter ──────────────────────────────────────────────────────────────
type FilterValue = ContentIdeaStatus | 'all';

const FILTER_LABELS: Record<FilterValue, string> = {
  all: 'All',
  captured: 'Captured',
  developed: 'Developed',
  scripted: 'Scripted',
  archived: 'Archived',
};

// ── Main client component ─────────────────────────────────────────────────────
export function IdeasInboxClient({
  initialIdeas,
  initialOpportunities,
}: {
  initialIdeas: (ContentIdea & { idea_score?: number })[];
  initialOpportunities: StoryOpportunity[];
}) {
  const [ideas, setIdeas] = useState(initialIdeas);
  const [filter, setFilter] = useState<FilterValue>('all');

  function handleIdeaAdded(idea: ContentIdea & { idea_score?: number }) {
    setIdeas((prev) => [idea, ...prev]);
  }

  const filters: FilterValue[] = ['all', ...CONTENT_IDEA_STATUSES];
  const filtered = filter === 'all' ? ideas : ideas.filter((i) => i.status === filter);

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      {/* Left — Idea inbox */}
      <div className="flex flex-col gap-5">
        <QuickAddForm onAdded={handleIdeaAdded} />

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold transition"
              style={
                filter === f
                  ? { background: brand.accent, color: '#fff' }
                  : { background: '#F1F5F9', color: '#64748B' }
              }
            >
              {FILTER_LABELS[f]}
              {f !== 'all' && (
                <span className="ml-1.5 tabular-nums opacity-70">
                  {ideas.filter((i) => i.status === f).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Idea cards */}
        {filtered.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/90 p-8 text-center">
            <p className="text-sm text-slate-500">
              {filter === 'all'
                ? 'No ideas in your inbox yet. Add one above or pull from sources.'
                : `No ideas with status "${FILTER_LABELS[filter]}".`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>

      {/* Right — Pull from sources */}
      <SourcesPanel
        opportunities={initialOpportunities}
        onAddFromOpp={handleIdeaAdded}
      />
    </div>
  );
}
