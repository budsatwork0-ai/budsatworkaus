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
import { type ContentIdea } from '@/types/content-idea';
import {
  CONTENT_SCRIPT_STATUSES,
  CONTENT_SCRIPT_STATUS_STYLES,
  type ContentScript,
  type ContentScriptStatus,
} from '@/types/content-script';

type ScriptDraft = {
  idea_id: string;
  hook: string;
  setup: string;
  core_moment: string;
  close_cta: string;
  platform: string;
  format: string;
  status: ContentScriptStatus;
  notes: string;
};

function emptyDraft(): ScriptDraft {
  return {
    idea_id: '',
    hook: '',
    setup: '',
    core_moment: '',
    close_cta: '',
    platform: '',
    format: '',
    status: 'draft',
    notes: '',
  };
}

function scriptToDraft(script: ContentScript): ScriptDraft {
  return {
    idea_id: script.idea_id,
    hook: script.hook,
    setup: script.setup,
    core_moment: script.core_moment,
    close_cta: script.close_cta,
    platform: script.platform,
    format: script.format,
    status: script.status,
    notes: script.notes,
  };
}

function draftFromIdea(idea: ContentIdea): ScriptDraft {
  return {
    idea_id: idea.id,
    hook: idea.hook,
    setup: '',
    core_moment: idea.content_angle,
    close_cta: '',
    platform: idea.platform_fit,
    format: idea.format,
    status: 'draft',
    notes: idea.notes ? `Source idea notes:\n${idea.notes}` : '',
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function ContentStudioScriptsPage() {
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [opps, setOpps] = useState<StoryOpportunity[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeStatus, setActiveStatus] = useState<ContentScriptStatus>('draft');
  const [draft, setDraft] = useState<ScriptDraft>(() => emptyDraft());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [sRes, iRes, oRes, aRes] = await Promise.all([
        fetch('/api/content-scripts'),
        fetch('/api/content-ideas'),
        fetch('/api/story-opportunities'),
        fetch('/api/story-arcs'),
      ]);
      if (!sRes.ok) throw new Error('Failed to load scripts');
      const [sj, ij, oj, aj] = await Promise.all([sRes.json(), iRes.json(), oRes.json(), aRes.json()]);
      setScripts(sj.scripts ?? []);
      setIdeas(ij.ideas ?? []);
      setOpps(oj.opportunities ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load Content Studio scripts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ideaId = new URLSearchParams(window.location.search).get('idea_id');
    if (!ideaId || ideas.length === 0) return;
    const idea = ideas.find((item) => item.id === ideaId);
    if (idea) setDraft(draftFromIdea(idea));
  }, [ideas]);

  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  const oppById = useMemo(() => new Map(opps.map((opp) => [opp.id, opp])), [opps]);
  const arcById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);
  const scriptedIdeaIds = useMemo(() => new Set(scripts.map((script) => script.idea_id)), [scripts]);

  const readyIdeas = useMemo(() => {
    return ideas
      .filter((idea) => idea.status !== 'archived' && !scriptedIdeaIds.has(idea.id))
      .sort((a, b) => a.priority - b.priority || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6);
  }, [ideas, scriptedIdeaIds]);

  const groupedTabs = CONTENT_SCRIPT_STATUSES.map((status) => ({
    key: status,
    label: CONTENT_SCRIPT_STATUS_STYLES[status].label,
    count: scripts.filter((script) => script.status === status).length,
  }));

  const visibleScripts = scripts
    .filter((script) => script.status === activeStatus)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  function selectIdea(ideaId: string) {
    const idea = ideaById.get(ideaId);
    setDraft(idea ? draftFromIdea(idea) : { ...draft, idea_id: '' });
  }

  async function createScript(payload: ScriptDraft) {
    if (!payload.idea_id) {
      toast.error('Linked idea is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/content-scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create script');
        return;
      }
      setScripts((prev) => [data as ContentScript, ...prev]);
      setDraft(emptyDraft());
      toast.success('Script saved');
    } catch {
      toast.error('Failed to create script');
    } finally {
      setSaving(false);
    }
  }

  function upsertScript(updated: ContentScript) {
    setScripts((prev) => prev.map((script) => script.id === updated.id ? updated : script));
  }

  function removeScript(id: string) {
    setScripts((prev) => prev.filter((script) => script.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content Studio"
        title="Scripts"
        description="Write manual scripts from content ideas. Approved scripts can be moved into the live Production Board."
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
          Phase 3B-lite boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Scripts are written manually. This layer does not generate copy, publish content, or run agents. Only approved scripts can enter the Production Board.
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
              <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Write script</h2>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Link one idea and write the script sections manually.
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
          <ScriptForm
            draft={draft}
            setDraft={setDraft}
            ideas={ideas}
            saving={saving}
            submitLabel="Save script"
            onIdeaSelect={selectIdea}
            onSubmit={() => createScript(draft)}
          />
        </section>

        <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Ideas ready to script</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Non-archived ideas without a script yet.
            </p>
          </div>
          <div className="grid gap-3">
            {readyIdeas.length === 0 ? (
              <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
                No unscripted ideas waiting.
              </p>
            ) : readyIdeas.map((idea) => (
              <IdeaContextCard
                key={idea.id}
                idea={idea}
                arc={idea.related_arc_id ? arcById.get(idea.related_arc_id) : undefined}
                opportunity={idea.opportunity_id ? oppById.get(idea.opportunity_id) : undefined}
                onUse={() => setDraft(draftFromIdea(idea))}
              />
            ))}
          </div>
        </section>
      </div>

      <WorkbenchTabs tabs={groupedTabs} activeTab={activeStatus} onTabChange={setActiveStatus} />

      <section className="grid gap-3">
        {loading ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>
            Loading scripts…
          </p>
        ) : visibleScripts.length === 0 ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>
            No {CONTENT_SCRIPT_STATUS_STYLES[activeStatus].label.toLowerCase()} scripts yet.
          </p>
        ) : visibleScripts.map((script) => {
          const idea = ideaById.get(script.idea_id);
          const opportunity = idea?.opportunity_id ? oppById.get(idea.opportunity_id) : undefined;
          const arc = idea?.related_arc_id ? arcById.get(idea.related_arc_id) : undefined;
          return (
            <ScriptCard
              key={script.id}
              script={script}
              idea={idea}
              opportunity={opportunity}
              arc={arc}
              ideas={ideas}
              onUpdated={upsertScript}
              onDeleted={removeScript}
            />
          );
        })}
      </section>
    </div>
  );
}

function IdeaContextCard({
  idea,
  arc,
  opportunity,
  onUse,
}: {
  idea: ContentIdea;
  arc?: StoryArc;
  opportunity?: StoryOpportunity;
  onUse: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{idea.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: dashboardTheme.color.muted }}>
            {idea.content_angle || 'No content angle captured yet.'}
          </p>
        </div>
        {opportunity?.story_score !== null && opportunity?.story_score !== undefined && (
          <ScorePill score={opportunity.story_score} />
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {idea.platform_fit && <Chip>{idea.platform_fit}</Chip>}
        {idea.format && <Chip>{idea.format}</Chip>}
        {arc && <Chip>{arc.title}</Chip>}
      </div>
      <button
        type="button"
        onClick={onUse}
        className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
        style={{ background: '#EFF6FF', color: '#1D4ED8' }}
      >
        Use for script
      </button>
    </div>
  );
}

function ScriptCard({
  script,
  idea,
  opportunity,
  arc,
  ideas,
  onUpdated,
  onDeleted,
}: {
  script: ContentScript;
  idea?: ContentIdea;
  opportunity?: StoryOpportunity;
  arc?: StoryArc;
  ideas: ContentIdea[];
  onUpdated: (script: ContentScript) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScriptDraft>(() => scriptToDraft(script));
  const [saving, setSaving] = useState(false);
  const style = CONTENT_SCRIPT_STATUS_STYLES[script.status];

  useEffect(() => {
    if (!editing) setDraft(scriptToDraft(script));
  }, [editing, script]);

  function applyIdea(ideaId: string) {
    const selected = ideas.find((item) => item.id === ideaId);
    setDraft(selected ? draftFromIdea(selected) : { ...draft, idea_id: '' });
  }

  async function save() {
    if (!draft.idea_id) {
      toast.error('Linked idea is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/content-scripts/${script.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update script');
        return;
      }
      onUpdated(data as ContentScript);
      setEditing(false);
      toast.success('Script updated');
    } catch {
      toast.error('Failed to update script');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this script? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content-scripts/${script.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(script.id);
      toast.success('Script deleted');
    } catch {
      toast.error('Failed to delete script');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      {editing ? (
        <div>
          <ScriptForm
            draft={draft}
            setDraft={setDraft}
            ideas={ideas}
            saving={saving}
            submitLabel="Save script"
            onIdeaSelect={applyIdea}
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
            Delete script
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
                  {idea?.title ?? 'Unlinked idea'}
                </h2>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                  {style.label}
                </span>
                {script.status === 'approved' && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: '#ECFDF5', color: '#047857' }}>
                    Production Board eligible
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Updated {formatDate(script.updated_at)}
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
            {script.status === 'approved' && (
              <Link
                href={`/dashboard/content-studio/production?script_id=${script.id}`}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                style={{ background: '#ECFDF5', color: '#047857' }}
              >
                Create production card
              </Link>
            )}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Linked idea">{idea?.title ?? 'Missing idea'}</Field>
            <Field label="Story arc">{arc?.title ?? 'No arc linked'}</Field>
            <Field label="Characters">
              {idea && idea.related_characters.length > 0 ? (
                <span className="inline-flex flex-wrap gap-1.5">
                  {idea.related_characters.map((name) => <Chip key={name}>{name}</Chip>)}
                </span>
              ) : 'None'}
            </Field>
            <Field label="Opportunity score">
              {opportunity?.story_score !== null && opportunity?.story_score !== undefined ? (
                <ScorePill score={opportunity.story_score} />
              ) : 'No linked scored opportunity'}
            </Field>
            <Field label="Platform">{script.platform || 'Not set'}</Field>
            <Field label="Format">{script.format || 'Not set'}</Field>
            <Field label="Hook">{script.hook || 'Not written yet'}</Field>
            <Field label="Setup">{script.setup || 'Not written yet'}</Field>
            <Field label="Core moment">{script.core_moment || 'Not written yet'}</Field>
            <Field label="Close / CTA">{script.close_cta || 'Not written yet'}</Field>
            {script.notes && (
              <div className="lg:col-span-2">
                <Field label="Notes">{script.notes}</Field>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function ScriptForm({
  draft,
  setDraft,
  ideas,
  saving,
  submitLabel,
  onIdeaSelect,
  onSubmit,
  onCancel,
}: {
  draft: ScriptDraft;
  setDraft: (draft: ScriptDraft) => void;
  ideas: ContentIdea[];
  saving: boolean;
  submitLabel: string;
  onIdeaSelect: (id: string) => void;
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
          <Label>Linked idea</Label>
          <select
            value={draft.idea_id}
            onChange={(e) => onIdeaSelect(e.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.idea_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">Select content idea</option>
            {ideas.map((idea) => (
              <option key={idea.id} value={idea.id}>
                {idea.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <Label>Platform</Label>
          <select
            value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.platform ? dashboardTheme.color.text : dashboardTheme.color.muted }}
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

        <label className="lg:col-span-2">
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentScriptStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {CONTENT_SCRIPT_STATUSES.map((status) => (
              <option key={status} value={status}>{CONTENT_SCRIPT_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>
      </div>

      <ScriptTextarea label="Hook" value={draft.hook} onChange={(value) => setDraft({ ...draft, hook: value })} />
      <ScriptTextarea label="Setup" value={draft.setup} onChange={(value) => setDraft({ ...draft, setup: value })} />
      <ScriptTextarea label="Core moment" value={draft.core_moment} onChange={(value) => setDraft({ ...draft, core_moment: value })} />
      <ScriptTextarea label="Close / CTA" value={draft.close_cta} onChange={(value) => setDraft({ ...draft, close_cta: value })} />
      <ScriptTextarea label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} rows={3} />

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

function ScriptTextarea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label>
      <Label>{label}</Label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
        style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
      />
    </label>
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
    <span className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: tier.bg, color: tier.fg }}>
      {score} · {tier.label}
    </span>
  );
}
