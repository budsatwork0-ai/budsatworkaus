'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader, WorkbenchTabs } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  SUGGESTED_FORMATS,
  SUGGESTED_PLATFORMS,
  getScoreTier,
  type StoryArc,
  type StoryOpportunity,
} from '@/types/story-engine';
import {
  CONTENT_IDEA_STATUSES,
  CONTENT_IDEA_STATUS_STYLES,
  type ContentIdea,
  type ContentIdeaStatus,
} from '@/types/content-idea';

const CHARACTER_OPTIONS = ['Jackson Taylor', 'Silvan', 'Buds At Work'];

type IdeaDraft = {
  title: string;
  opportunity_id: string;
  related_arc_id: string;
  related_characters: string[];
  platform_fit: string;
  format: string;
  hook: string;
  content_angle: string;
  status: ContentIdeaStatus;
  priority: number;
  notes: string;
};

function emptyDraft(): IdeaDraft {
  return {
    title: '',
    opportunity_id: '',
    related_arc_id: '',
    related_characters: [],
    platform_fit: '',
    format: '',
    hook: '',
    content_angle: '',
    status: 'captured',
    priority: 0,
    notes: '',
  };
}

function ideaToDraft(idea: ContentIdea): IdeaDraft {
  return {
    title: idea.title,
    opportunity_id: idea.opportunity_id ?? '',
    related_arc_id: idea.related_arc_id ?? '',
    related_characters: idea.related_characters,
    platform_fit: idea.platform_fit,
    format: idea.format,
    hook: idea.hook,
    content_angle: idea.content_angle,
    status: idea.status,
    priority: idea.priority,
    notes: idea.notes,
  };
}

function draftFromOpportunity(opp: StoryOpportunity): IdeaDraft {
  return {
    title: opp.title,
    opportunity_id: opp.id,
    related_arc_id: opp.related_arc_id ?? '',
    related_characters: opp.related_characters,
    platform_fit: opp.suggested_platform,
    format: opp.suggested_format,
    hook: '',
    content_angle: opp.content_angle,
    status: 'captured',
    priority: Math.max(0, 100 - (opp.story_score ?? 50)),
    notes: opp.score_reason ? `Source score: ${opp.story_score ?? 'Unscored'}\n${opp.score_reason}` : '',
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ContentStudioIdeasPage() {
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [opps, setOpps] = useState<StoryOpportunity[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStatus, setActiveStatus] = useState<ContentIdeaStatus>('captured');
  const [draft, setDraft] = useState<IdeaDraft>(() => emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [iRes, oRes, aRes] = await Promise.all([
        fetch('/api/content-ideas'),
        fetch('/api/story-opportunities'),
        fetch('/api/story-arcs'),
      ]);
      if (!iRes.ok) throw new Error('Failed to load ideas');
      const [ij, oj, aj] = await Promise.all([iRes.json(), oRes.json(), aRes.json()]);
      setIdeas(ij.ideas ?? []);
      setOpps(oj.opportunities ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load Content Studio ideas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const opportunityId = new URLSearchParams(window.location.search).get('opportunity_id');
    if (!opportunityId || opps.length === 0) return;
    const opp = opps.find((item) => item.id === opportunityId);
    if (opp) setDraft(draftFromOpportunity(opp));
  }, [opps]);

  const oppById = useMemo(() => new Map(opps.map((opp) => [opp.id, opp])), [opps]);
  const arcById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);
  const linkedOpportunityIds = useMemo(
    () => new Set(ideas.map((idea) => idea.opportunity_id).filter(Boolean)),
    [ideas],
  );

  const scoredOpportunities = useMemo(() => {
    return [...opps]
      .filter((opp) => opp.story_score !== null && opp.story_score !== undefined && !linkedOpportunityIds.has(opp.id))
      .sort((a, b) => (b.story_score ?? -1) - (a.story_score ?? -1))
      .slice(0, 6);
  }, [linkedOpportunityIds, opps]);

  const groupedTabs = CONTENT_IDEA_STATUSES.map((status) => ({
    key: status,
    label: CONTENT_IDEA_STATUS_STYLES[status].label,
    count: ideas.filter((idea) => idea.status === status).length,
  }));

  const visibleIdeas = ideas
    .filter((idea) => idea.status === activeStatus)
    .sort((a, b) => a.priority - b.priority || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  async function createIdea(payload: IdeaDraft) {
    if (!payload.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/content-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          opportunity_id: payload.opportunity_id || null,
          related_arc_id: payload.related_arc_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create idea');
        return;
      }
      setIdeas((prev) => [data as ContentIdea, ...prev]);
      setDraft(emptyDraft());
      toast.success('Idea captured');
    } catch {
      toast.error('Failed to create idea');
    } finally {
      setSaving(false);
    }
  }

  async function captureOpportunity(opp: StoryOpportunity) {
    await createIdea(draftFromOpportunity(opp));
  }

  function applyOpportunityToDraft(opportunityId: string) {
    const opp = oppById.get(opportunityId);
    setDraft(opp ? draftFromOpportunity(opp) : { ...draft, opportunity_id: '' });
  }

  function upsertIdea(updated: ContentIdea) {
    setIdeas((prev) => prev.map((idea) => idea.id === updated.id ? updated : idea));
  }

  function removeIdea(id: string) {
    setIdeas((prev) => prev.filter((idea) => idea.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content Studio"
        title="Ideas"
        description="Capture story-grounded content ideas from scored Story Opportunities or manual notes. Ideas stop here until a later script phase."
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
          Phase 3A boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Ideas can be captured, developed, scripted as a status, or archived. This layer does not generate scripts, create assets, publish content, or run agents.
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
              <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Capture idea</h2>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Create manually or link a scored Story Opportunity.
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
          <IdeaForm
            draft={draft}
            setDraft={setDraft}
            opportunities={opps}
            arcs={arcs}
            saving={saving}
            submitLabel="Capture idea"
            onOpportunitySelect={applyOpportunityToDraft}
            onSubmit={() => createIdea(draft)}
          />
        </section>

        <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>High-scoring opportunities</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Scored story moments not yet linked to an idea.
            </p>
          </div>
          <div className="grid gap-3">
            {scoredOpportunities.length === 0 ? (
              <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
                No scored opportunities waiting to convert.
              </p>
            ) : scoredOpportunities.map((opp) => (
              <OpportunityConvertCard
                key={opp.id}
                opp={opp}
                arc={opp.related_arc_id ? arcById.get(opp.related_arc_id) : undefined}
                saving={saving}
                onCapture={() => captureOpportunity(opp)}
              />
            ))}
          </div>
        </section>
      </div>

      <WorkbenchTabs tabs={groupedTabs} activeTab={activeStatus} onTabChange={setActiveStatus} />

      <section className="grid gap-3">
        {loading ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>
            Loading ideas…
          </p>
        ) : visibleIdeas.length === 0 ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>
            No {CONTENT_IDEA_STATUS_STYLES[activeStatus].label.toLowerCase()} ideas yet.
          </p>
        ) : visibleIdeas.map((idea) => (
          <IdeaCard
            key={idea.id}
            idea={idea}
            opportunity={idea.opportunity_id ? oppById.get(idea.opportunity_id) : undefined}
            arc={idea.related_arc_id ? arcById.get(idea.related_arc_id) : undefined}
            opportunities={opps}
            arcs={arcs}
            onUpdated={upsertIdea}
            onDeleted={removeIdea}
          />
        ))}
      </section>
    </div>
  );
}

function OpportunityConvertCard({
  opp,
  arc,
  saving,
  onCapture,
}: {
  opp: StoryOpportunity;
  arc?: StoryArc;
  saving: boolean;
  onCapture: () => void;
}) {
  const score = opp.story_score ?? 0;
  const tier = getScoreTier(score);
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{opp.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: dashboardTheme.color.muted }}>
            {opp.content_angle || 'No content angle captured yet.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tier.bg, color: tier.fg }}>
          {score}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {opp.suggested_platform && <Chip>{opp.suggested_platform}</Chip>}
        {opp.suggested_format && <Chip>{opp.suggested_format}</Chip>}
        {arc && <Chip>{arc.title}</Chip>}
      </div>
      <button
        type="button"
        onClick={onCapture}
        disabled={saving}
        className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50"
        style={{ background: '#ECFDF5', color: '#047857' }}
      >
        Capture as idea
      </button>
    </div>
  );
}

function IdeaCard({
  idea,
  opportunity,
  arc,
  opportunities,
  arcs,
  onUpdated,
  onDeleted,
}: {
  idea: ContentIdea;
  opportunity?: StoryOpportunity;
  arc?: StoryArc;
  opportunities: StoryOpportunity[];
  arcs: StoryArc[];
  onUpdated: (idea: ContentIdea) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<IdeaDraft>(() => ideaToDraft(idea));
  const [saving, setSaving] = useState(false);
  const style = CONTENT_IDEA_STATUS_STYLES[idea.status];

  useEffect(() => {
    if (!editing) setDraft(ideaToDraft(idea));
  }, [editing, idea]);

  async function save() {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/content-ideas/${idea.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          opportunity_id: draft.opportunity_id || null,
          related_arc_id: draft.related_arc_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update idea');
        return;
      }
      onUpdated(data as ContentIdea);
      setEditing(false);
      toast.success('Idea updated');
    } catch {
      toast.error('Failed to update idea');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this idea? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content-ideas/${idea.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(idea.id);
      toast.success('Idea deleted');
    } catch {
      toast.error('Failed to delete idea');
    } finally {
      setSaving(false);
    }
  }

  function applyOpportunityToDraft(opportunityId: string) {
    const opp = opportunities.find((item) => item.id === opportunityId);
    setDraft(opp ? draftFromOpportunity(opp) : { ...draft, opportunity_id: '' });
  }

  return (
    <article className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {editing ? (
        <div>
          <IdeaForm
            draft={draft}
            setDraft={setDraft}
            opportunities={opportunities}
            arcs={arcs}
            saving={saving}
            submitLabel="Save idea"
            onOpportunitySelect={applyOpportunityToDraft}
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="mt-3 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50 disabled:opacity-50"
            style={{ color: '#B91C1C' }}
          >
            Delete idea
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{idea.title}</h2>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                  {style.label}
                </span>
                <span className="rounded-full border px-2.5 py-0.5 text-[10px]" style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
                  Priority {idea.priority}
                </span>
              </div>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Captured {formatDate(idea.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Edit
            </button>
            {idea.status !== 'archived' && (
              <Link
                href={`/dashboard/content-studio/scripts?idea_id=${idea.id}`}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                style={{ background: '#EFF6FF', color: '#1D4ED8' }}
              >
                Write script
              </Link>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Source opportunity">
              {opportunity ? (
                <span>
                  {opportunity.title}
                  {opportunity.story_score !== null && opportunity.story_score !== undefined && (
                    <ScorePill score={opportunity.story_score} />
                  )}
                </span>
              ) : 'Manual idea'}
            </Field>
            <Field label="Related arc">{arc?.title ?? 'No arc linked'}</Field>
            <Field label="Platform fit">{idea.platform_fit || 'Not set'}</Field>
            <Field label="Format">{idea.format || 'Not set'}</Field>
            <Field label="Related characters">
              {idea.related_characters.length > 0 ? (
                <span className="inline-flex flex-wrap gap-1.5">
                  {idea.related_characters.map((name) => <Chip key={name}>{name}</Chip>)}
                </span>
              ) : 'None'}
            </Field>
            <Field label="Hook">{idea.hook || 'Not captured yet'}</Field>
            <div className="lg:col-span-2">
              <Field label="Content angle">{idea.content_angle || 'No angle captured yet'}</Field>
            </div>
            {idea.notes && (
              <div className="lg:col-span-2">
                <Field label="Notes">{idea.notes}</Field>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function IdeaForm({
  draft,
  setDraft,
  opportunities,
  arcs,
  saving,
  submitLabel,
  onOpportunitySelect,
  onSubmit,
  onCancel,
}: {
  draft: IdeaDraft;
  setDraft: (draft: IdeaDraft) => void;
  opportunities: StoryOpportunity[];
  arcs: StoryArc[];
  saving: boolean;
  submitLabel: string;
  onOpportunitySelect: (id: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="lg:col-span-2">
          <Label>Title</Label>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            placeholder="e.g. First recurring customer proves the model"
          />
        </label>

        <label>
          <Label>Source opportunity</Label>
          <select
            value={draft.opportunity_id}
            onChange={(e) => onOpportunitySelect(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.opportunity_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">Manual idea — no opportunity link</option>
            {opportunities.map((opp) => (
              <option key={opp.id} value={opp.id}>
                {opp.story_score ?? 'Unscored'} · {opp.title}
              </option>
            ))}
          </select>
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
            {arcs.map((arc) => (
              <option key={arc.id} value={arc.id}>{arc.title}</option>
            ))}
          </select>
        </label>

        <label>
          <Label>Platform fit</Label>
          <select
            value={draft.platform_fit}
            onChange={(e) => setDraft({ ...draft, platform_fit: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.platform_fit ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">Select platform</option>
            {SUGGESTED_PLATFORMS.map((platform) => (
              <option key={platform} value={platform}>{platform}</option>
            ))}
          </select>
        </label>

        <label>
          <Label>Format</Label>
          <select
            value={draft.format}
            onChange={(e) => setDraft({ ...draft, format: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.format ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">Select format</option>
            {SUGGESTED_FORMATS.map((format) => (
              <option key={format} value={format}>{format}</option>
            ))}
          </select>
        </label>

        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentIdeaStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {CONTENT_IDEA_STATUSES.map((status) => (
              <option key={status} value={status}>{CONTENT_IDEA_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>

        <label>
          <Label>Priority</Label>
          <input
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
      </div>

      <div>
        <Label>Related characters</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHARACTER_OPTIONS.map((name) => {
            const isOn = draft.related_characters.includes(name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setDraft({
                  ...draft,
                  related_characters: isOn
                    ? draft.related_characters.filter((item) => item !== name)
                    : [...draft.related_characters, name],
                })}
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                style={isOn
                  ? { background: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' }
                  : { borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <label>
        <Label>Hook</Label>
        <input
          value={draft.hook}
          onChange={(e) => setDraft({ ...draft, hook: e.target.value })}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          placeholder="The first line or opening frame. No script yet."
        />
      </label>

      <label>
        <Label>Content angle</Label>
        <textarea
          value={draft.content_angle}
          onChange={(e) => setDraft({ ...draft, content_angle: e.target.value })}
          rows={3}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: dashboardTheme.color.muted }}>
        {label}
      </p>
      <div className="whitespace-pre-wrap text-sm leading-6" style={{ color: dashboardTheme.color.text }}>
        {children}
      </div>
    </div>
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
  const tier = getScoreTier(score);
  return (
    <span className="ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tier.bg, color: tier.fg }}>
      {score} · {tier.label}
    </span>
  );
}
