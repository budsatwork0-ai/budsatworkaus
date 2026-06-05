'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import { type ContentIdea } from '@/types/content-idea';
import { type ContentScript } from '@/types/content-script';
import {
  CONTENT_PRODUCTION_STATUSES,
  CONTENT_PRODUCTION_STATUS_STYLES,
  type ContentProductionCard,
  type ContentProductionStatus,
} from '@/types/content-production';
import { type StoryArc, type StoryOpportunity } from '@/types/story-engine';

type CardDraft = {
  script_id: string;
  title: string;
  platform: string;
  format: string;
  related_arc_id: string;
  related_characters: string[];
  deadline: string;
  status: ContentProductionStatus;
  notes: string;
};

const STATUS_ORDER = CONTENT_PRODUCTION_STATUSES;

function emptyDraft(): CardDraft {
  return {
    script_id: '',
    title: '',
    platform: '',
    format: '',
    related_arc_id: '',
    related_characters: [],
    deadline: '',
    status: 'to_film',
    notes: '',
  };
}

function cardToDraft(card: ContentProductionCard): CardDraft {
  return {
    script_id: card.script_id,
    title: card.title,
    platform: card.platform,
    format: card.format,
    related_arc_id: card.related_arc_id ?? '',
    related_characters: card.related_characters,
    deadline: card.deadline ?? '',
    status: card.status,
    notes: card.notes,
  };
}

function draftFromScript(script: ContentScript, idea?: ContentIdea): CardDraft {
  return {
    script_id: script.id,
    title: idea?.title ?? 'Production card',
    platform: script.platform,
    format: script.format,
    related_arc_id: idea?.related_arc_id ?? '',
    related_characters: idea?.related_characters ?? [],
    deadline: '',
    status: 'to_film',
    notes: script.notes ? `Script notes:\n${script.notes}` : '',
  };
}

function formatDate(iso: string | null) {
  if (!iso) return 'No deadline';
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ContentStudioProductionPage() {
  const [cards, setCards] = useState<ContentProductionCard[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [opps, setOpps] = useState<StoryOpportunity[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [draft, setDraft] = useState<CardDraft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, sRes, iRes, oRes, aRes] = await Promise.all([
        fetch('/api/content-production'),
        fetch('/api/content-scripts'),
        fetch('/api/content-ideas'),
        fetch('/api/story-opportunities'),
        fetch('/api/story-arcs'),
      ]);
      if (!cRes.ok) throw new Error('Failed to load production cards');
      const [cj, sj, ij, oj, aj] = await Promise.all([cRes.json(), sRes.json(), iRes.json(), oRes.json(), aRes.json()]);
      setCards(cj.cards ?? []);
      setScripts(sj.scripts ?? []);
      setIdeas(ij.ideas ?? []);
      setOpps(oj.opportunities ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load Content Studio production board.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const scriptId = new URLSearchParams(window.location.search).get('script_id');
    if (!scriptId || scripts.length === 0) return;
    const script = scripts.find((item) => item.id === scriptId && item.status === 'approved');
    const idea = script ? ideas.find((item) => item.id === script.idea_id) : undefined;
    if (script) setDraft(draftFromScript(script, idea));
  }, [ideas, scripts]);

  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  const oppById = useMemo(() => new Map(opps.map((opp) => [opp.id, opp])), [opps]);
  const arcById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);
  const scriptById = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);
  const cardScriptIds = useMemo(() => new Set(cards.map((card) => card.script_id)), [cards]);

  const approvedScripts = useMemo(() => {
    return scripts
      .filter((script) => script.status === 'approved' && !cardScriptIds.has(script.id))
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [cardScriptIds, scripts]);

  async function createCard(payload: CardDraft) {
    if (!payload.script_id) {
      toast.error('Approved script is required');
      return;
    }
    if (!payload.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/content-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          related_arc_id: payload.related_arc_id || null,
          deadline: payload.deadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create production card');
        return;
      }
      setCards((prev) => [data as ContentProductionCard, ...prev]);
      setDraft(emptyDraft());
      toast.success('Production card created');
    } catch {
      toast.error('Failed to create production card');
    } finally {
      setSaving(false);
    }
  }

  function selectScript(scriptId: string) {
    const script = scriptById.get(scriptId);
    const idea = script ? ideaById.get(script.idea_id) : undefined;
    setDraft(script ? draftFromScript(script, idea) : { ...draft, script_id: '' });
  }

  function upsertCard(updated: ContentProductionCard) {
    setCards((prev) => prev.map((card) => card.id === updated.id ? updated : card));
  }

  function removeCard(id: string) {
    setCards((prev) => prev.filter((card) => card.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content Studio"
        title="Production Board"
        description="Manual production tracking for approved scripts. Ready to Publish is only a board status; it does not publish or create queue items."
        actions={
          <Link
            href="/dashboard/content-studio"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            Content Studio Overview
          </Link>
        }
      />

      <div className="rounded-[20px] border px-5 py-4" style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,0.25)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>
          Phase 3C boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Only approved scripts can create cards. Movement is manual. Ready to Publish does not create a Publishing Queue item. No AI generation, agents, or automations are active here.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Create production card</h2>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Select an approved script and schedule the production work manually.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDraft(emptyDraft())}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
              style={{ color: dashboardTheme.color.muted }}
            >
              Clear
            </button>
          </div>
          <ProductionForm
            draft={draft}
            setDraft={setDraft}
            approvedScripts={approvedScripts}
            ideas={ideas}
            arcs={arcs}
            saving={saving}
            submitLabel="Create card"
            onScriptSelect={selectScript}
            onSubmit={() => createCard(draft)}
          />
        </section>

        <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Approved scripts ready</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Approved scripts not yet on the board.
            </p>
          </div>
          <div className="grid gap-3">
            {approvedScripts.length === 0 ? (
              <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
                No approved scripts waiting for production.
              </p>
            ) : approvedScripts.slice(0, 6).map((script) => {
              const idea = ideaById.get(script.idea_id);
              const opportunity = idea?.opportunity_id ? oppById.get(idea.opportunity_id) : undefined;
              const arc = idea?.related_arc_id ? arcById.get(idea.related_arc_id) : undefined;
              return (
                <ApprovedScriptCard
                  key={script.id}
                  script={script}
                  idea={idea}
                  arc={arc}
                  opportunity={opportunity}
                  onUse={() => setDraft(draftFromScript(script, idea))}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="grid gap-3 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const style = CONTENT_PRODUCTION_STATUS_STYLES[status];
          const items = cards
            .filter((card) => card.status === status)
            .sort((a, b) => (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31'));
          return (
            <div key={status} className="rounded-[24px] border border-black/5 bg-white/80 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{style.label}</h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                  {items.length}
                </span>
              </div>
              <div className="grid gap-3">
                {loading ? (
                  <p className="rounded-2xl border border-black/5 bg-white px-3 py-6 text-center text-xs" style={{ color: dashboardTheme.color.muted }}>
                    Loading…
                  </p>
                ) : items.length === 0 ? (
                  <p className="rounded-2xl border border-black/5 bg-white px-3 py-6 text-center text-xs" style={{ color: dashboardTheme.color.muted }}>
                    No cards
                  </p>
                ) : items.map((card) => {
                  const script = scriptById.get(card.script_id);
                  const idea = script ? ideaById.get(script.idea_id) : undefined;
                  const opportunity = idea?.opportunity_id ? oppById.get(idea.opportunity_id) : undefined;
                  const arc = card.related_arc_id ? arcById.get(card.related_arc_id) : undefined;
                  return (
                    <ProductionCard
                      key={card.id}
                      card={card}
                      script={script}
                      idea={idea}
                      opportunity={opportunity}
                      arc={arc}
                      approvedScripts={scripts.filter((item) => item.status === 'approved')}
                      ideas={ideas}
                      arcs={arcs}
                      onUpdated={upsertCard}
                      onDeleted={removeCard}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function ApprovedScriptCard({
  script,
  idea,
  arc,
  opportunity,
  onUse,
}: {
  script: ContentScript;
  idea?: ContentIdea;
  arc?: StoryArc;
  opportunity?: StoryOpportunity;
  onUse: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{idea?.title ?? 'Untitled script'}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: dashboardTheme.color.muted }}>
            {script.hook || script.core_moment || 'Approved script ready for production.'}
          </p>
        </div>
        {opportunity?.story_score !== null && opportunity?.story_score !== undefined && <ScorePill score={opportunity.story_score} />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {script.platform && <Chip>{script.platform}</Chip>}
        {script.format && <Chip>{script.format}</Chip>}
        {arc && <Chip>{arc.title}</Chip>}
      </div>
      <button
        type="button"
        onClick={onUse}
        className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
        style={{ background: '#ECFDF5', color: '#047857' }}
      >
        Use for production
      </button>
    </div>
  );
}

function ProductionCard({
  card,
  script,
  idea,
  opportunity,
  arc,
  approvedScripts,
  ideas,
  arcs,
  onUpdated,
  onDeleted,
}: {
  card: ContentProductionCard;
  script?: ContentScript;
  idea?: ContentIdea;
  opportunity?: StoryOpportunity;
  arc?: StoryArc;
  approvedScripts: ContentScript[];
  ideas: ContentIdea[];
  arcs: StoryArc[];
  onUpdated: (card: ContentProductionCard) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CardDraft>(() => cardToDraft(card));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(cardToDraft(card));
  }, [card, editing]);

  const ideaById = useMemo(() => new Map(ideas.map((item) => [item.id, item])), [ideas]);
  const scriptById = useMemo(() => new Map(approvedScripts.map((item) => [item.id, item])), [approvedScripts]);

  function selectScript(scriptId: string) {
    const selected = scriptById.get(scriptId);
    const selectedIdea = selected ? ideaById.get(selected.idea_id) : undefined;
    setDraft(selected ? draftFromScript(selected, selectedIdea) : { ...draft, script_id: '' });
  }

  async function save(next?: Partial<CardDraft>) {
    const payload = { ...draft, ...next };
    setSaving(true);
    try {
      const res = await fetch(`/api/content-production/${card.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          related_arc_id: payload.related_arc_id || null,
          deadline: payload.deadline || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update card');
        return;
      }
      onUpdated(data as ContentProductionCard);
      setEditing(false);
      toast.success('Production card updated');
    } catch {
      toast.error('Failed to update card');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this production card? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content-production/${card.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(card.id);
      toast.success('Production card deleted');
    } catch {
      toast.error('Failed to delete card');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4">
      {editing ? (
        <div>
          <ProductionForm
            draft={draft}
            setDraft={setDraft}
            approvedScripts={approvedScripts}
            ideas={ideas}
            arcs={arcs}
            saving={saving}
            submitLabel="Save card"
            onScriptSelect={selectScript}
            onSubmit={() => save()}
            onCancel={() => setEditing(false)}
          />
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="mt-3 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50 disabled:opacity-50"
            style={{ color: '#B91C1C' }}
          >
            Delete card
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{card.title}</h3>
              <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {formatDate(card.deadline)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Edit
            </button>
          </div>

          <div className="mt-3 grid gap-2 text-xs" style={{ color: dashboardTheme.color.text }}>
            <p><strong>Script:</strong> {idea?.title ?? script?.id ?? 'Missing script'}</p>
            <p><strong>Platform:</strong> {card.platform || 'Not set'}</p>
            <p><strong>Format:</strong> {card.format || 'Not set'}</p>
            <p><strong>Arc:</strong> {arc?.title ?? 'No arc linked'}</p>
            <p>
              <strong>Characters:</strong>{' '}
              {card.related_characters.length > 0 ? card.related_characters.join(', ') : 'None'}
            </p>
            <p>
              <strong>Opportunity:</strong>{' '}
              {opportunity?.story_score !== null && opportunity?.story_score !== undefined ? <ScorePill score={opportunity.story_score} /> : 'No score'}
            </p>
            {card.notes && <p className="whitespace-pre-wrap"><strong>Notes:</strong> {card.notes}</p>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_ORDER.filter((status) => status !== card.status).map((status) => {
              const style = CONTENT_PRODUCTION_STATUS_STYLES[status];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => save({ status })}
                  disabled={saving}
                  className="rounded-full px-2 py-1 text-[10px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: style.bg, color: style.fg }}
                >
                  {style.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </article>
  );
}

function ProductionForm({
  draft,
  setDraft,
  approvedScripts,
  ideas,
  arcs,
  saving,
  submitLabel,
  onScriptSelect,
  onSubmit,
  onCancel,
}: {
  draft: CardDraft;
  setDraft: (draft: CardDraft) => void;
  approvedScripts: ContentScript[];
  ideas: ContentIdea[];
  arcs: StoryArc[];
  saving: boolean;
  submitLabel: string;
  onScriptSelect: (id: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label>
        <Label>Approved script</Label>
        <select
          value={draft.script_id}
          onChange={(e) => onScriptSelect(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: draft.script_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
        >
          <option value="">Select approved script</option>
          {approvedScripts.map((script) => (
            <option key={script.id} value={script.id}>
              {ideaById.get(script.idea_id)?.title ?? script.id}
            </option>
          ))}
        </select>
      </label>

      <label>
        <Label>Title</Label>
        <input
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Platform</Label>
          <input
            value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Format</Label>
          <input
            value={draft.format}
            onChange={(e) => setDraft({ ...draft, format: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Related arc</Label>
          <select
            value={draft.related_arc_id}
            onChange={(e) => setDraft({ ...draft, related_arc_id: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.related_arc_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">No arc linked</option>
            {arcs.map((arc) => <option key={arc.id} value={arc.id}>{arc.title}</option>)}
          </select>
        </label>
        <label>
          <Label>Deadline</Label>
          <input
            type="date"
            value={draft.deadline}
            onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label className="md:col-span-2">
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentProductionStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{CONTENT_PRODUCTION_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Related characters</Label>
        <input
          value={draft.related_characters.join(', ')}
          onChange={(e) => setDraft({
            ...draft,
            related_characters: e.target.value.split(',').map((item) => item.trim()).filter(Boolean),
          })}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Notes</Label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary, color: '#fff' }}
        >
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-slate-100"
            style={{ color: dashboardTheme.color.muted }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
      {children}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
      {children}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const tier = score >= 75
    ? { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Strong' }
    : score >= 60
    ? { bg: '#F0FDF4', fg: '#15803D', label: 'Good' }
    : score >= 40
    ? { bg: '#FFFBEB', fg: '#B45309', label: 'Moderate' }
    : { bg: '#FEF2F2', fg: '#B91C1C', label: 'Weak' };
  return (
    <span className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tier.bg, color: tier.fg }}>
      {score} · {tier.label}
    </span>
  );
}
