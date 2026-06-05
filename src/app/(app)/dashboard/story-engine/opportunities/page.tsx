'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader, WorkbenchTabs } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  OPP_SECTIONS,
  OPP_STATUSES,
  OPP_STATUS_STYLES,
  OPP_SOURCE_LABELS,
  SUGGESTED_FORMATS,
  SUGGESTED_PLATFORMS,
  DRAFT_STATUS_STYLES,
  DRAFT_STATUSES,
  STORY_SCORE_TIERS,
  getScoreTier,
  type StorySortKey,
  type StoryOpportunity,
  type OpportunityStatus,
  type OpportunitySection,
  type OpportunitySourceType,
  type StoryArc,
  type DetectionSummary,
  type StoryDraft,
  type DraftStatus,
} from '@/types/story-engine';

const CHARACTER_OPTIONS = ['Jackson Taylor', 'Silvan', 'Buds At Work'];

const SOURCE_TYPES: OpportunitySourceType[] = [
  'manual', 'journal', 'arc', 'open_thread', 'chapter', 'character', 'milestone',
];

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Status display order within a section
const STATUS_ORDER: OpportunityStatus[] = ['new', 'in_development', 'published', 'passed'];

type OppDraft = {
  title: string;
  source_type: OpportunitySourceType;
  source_ref_id: string;
  related_arc_id: string;
  related_characters: string[];
  content_angle: string;
  suggested_format: string;
  suggested_platform: string;
  priority: number;
  status: OpportunityStatus;
  section: OpportunitySection;
  notes: string;
};

function emptyDraft(defaultSection: OpportunitySection = 'surfaced'): OppDraft {
  return {
    title: '',
    source_type: 'manual',
    source_ref_id: '',
    related_arc_id: '',
    related_characters: [],
    content_angle: '',
    suggested_format: '',
    suggested_platform: '',
    priority: 0,
    status: 'new',
    section: defaultSection,
    notes: '',
  };
}

function oppToDraft(o: StoryOpportunity): OppDraft {
  return {
    title:              o.title,
    source_type:        o.source_type,
    source_ref_id:      o.source_ref_id ?? '',
    related_arc_id:     o.related_arc_id ?? '',
    related_characters: o.related_characters,
    content_angle:      o.content_angle,
    suggested_format:   o.suggested_format,
    suggested_platform: o.suggested_platform,
    priority:           o.priority,
    status:             o.status,
    section:            o.section,
    notes:              o.notes,
  };
}

export default function StoryOpportunitiesPage() {
  const [opps, setOpps] = useState<StoryOpportunity[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<OpportunitySection>('surfaced');
  const [creating, setCreating] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [sortKey, setSortKey] = useState<StorySortKey>('story_score');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [oRes, aRes] = await Promise.all([
        fetch('/api/story-opportunities'),
        fetch('/api/story-arcs'),
      ]);
      if (!oRes.ok) throw new Error('Failed to load opportunities');
      const [oj, aj] = await Promise.all([oRes.json(), aRes.json()]);
      setOpps(oj.opportunities ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load opportunities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function upsertOpp(updated: StoryOpportunity) {
    setOpps((prev) => {
      const exists = prev.some((o) => o.id === updated.id);
      return exists ? prev.map((o) => o.id === updated.id ? updated : o) : [updated, ...prev];
    });
  }

  function removeOpp(id: string) {
    setOpps((prev) => prev.filter((o) => o.id !== id));
  }

  async function runDetection() {
    setDetecting(true);
    try {
      const res = await fetch('/api/story-opportunities/detect', { method: 'POST' });
      const summary: DetectionSummary = await res.json();
      if (summary.created > 0) {
        toast.success(`Detection complete — ${summary.created} new ${summary.created === 1 ? 'opportunity' : 'opportunities'} found`);
        await load();
      } else if (summary.errors.length > 0) {
        toast.error(`Detection errors: ${summary.errors[0]}`);
      } else {
        toast.success(`Detection complete — no new opportunities (${summary.skipped} already existed)`);
      }
    } catch {
      toast.error('Detection failed');
    } finally {
      setDetecting(false);
    }
  }

  async function scoreAllOpportunities() {
    setScoring(true);
    try {
      const res = await fetch('/api/story-opportunities/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score_all: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Scoring failed'); return; }
      toast.success(`Scored ${data.scored} ${data.scored === 1 ? 'opportunity' : 'opportunities'}`);
      await load();
    } catch {
      toast.error('Scoring failed — check connection');
    } finally {
      setScoring(false);
    }
  }

  const sectionOpps = opps.filter((o) => o.section === activeSection);
  const sectionCounts = OPP_SECTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s.key] = opps.filter((o) => o.section === s.key).length;
    return acc;
  }, {});

  const currentSectionDef = OPP_SECTIONS.find((s) => s.key === activeSection)!;

  function sortItems(items: StoryOpportunity[]): StoryOpportunity[] {
    if (sortKey === 'story_score') {
      return [...items].sort((a, b) => (b.story_score ?? -1) - (a.story_score ?? -1));
    }
    if (sortKey === 'newest') {
      return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return [...items].sort((a, b) => a.priority - b.priority);
  }

  // Group visible opps by status, sorted within each group
  const grouped = STATUS_ORDER.map((status) => ({
    status,
    items: sortItems(sectionOpps.filter((o) => o.status === status)),
  })).filter((g) => g.items.length > 0);

  const newCount = sectionOpps.filter((o) => o.status === 'new').length;

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Story Opportunities"
        description="Content-worthy story moments. Detect from real business data or capture manually. Triage and develop into content."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={scoreAllOpportunities}
              disabled={scoring}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#F0FDF4', color: '#047857' }}
            >
              {scoring ? 'Scoring…' : 'Score All'}
            </button>
            <button
              type="button"
              onClick={runDetection}
              disabled={detecting}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              {detecting ? 'Scanning…' : 'Run Detection'}
            </button>
            <button
              type="button"
              onClick={() => { setCreating(true); }}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: dashboardTheme.color.primary }}
            >
              + New Opportunity
            </button>
          </div>
        }
      />

      <NoAINote />

      {/* Section tabs */}
      <WorkbenchTabs
        tabs={OPP_SECTIONS.map((s) => ({
          key: s.key,
          label: s.label,
          count: sectionCounts[s.key] ?? 0,
        }))}
        activeTab={activeSection}
        onTabChange={(tab) => { setActiveSection(tab as OpportunitySection); setCreating(false); }}
      />

      {/* Section description */}
      <div
        className="rounded-[20px] border px-4 py-3"
        style={{ background: '#F8FAFC', borderColor: 'rgba(15,61,46,0.08)' }}
      >
        <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
          <strong style={{ color: dashboardTheme.color.primary }}>{currentSectionDef.label}:</strong>{' '}
          {currentSectionDef.description}
          {newCount > 0 && (
            <span className="ml-2 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{ background: '#ECFDF5', color: '#047857' }}>
              {newCount} new
            </span>
          )}
        </p>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: dashboardTheme.color.muted }}>
          Sort:
        </span>
        {(['story_score', 'newest', 'priority'] as StorySortKey[]).map((key) => {
          const labels: Record<StorySortKey, string> = {
            story_score: 'Story Score',
            newest:      'Newest',
            priority:    'Priority',
          };
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSortKey(key)}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
              style={
                sortKey === key
                  ? { background: dashboardTheme.color.primary, color: '#fff' }
                  : { background: '#F1F5F9', color: dashboardTheme.color.muted }
              }
            >
              {labels[key]}
            </button>
          );
        })}
      </div>

      {/* New opportunity form */}
      {creating && (
        <OppForm
          mode="new"
          defaultSection={activeSection}
          arcs={arcs}
          onSaved={(o) => { upsertOpp(o); setCreating(false); }}
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
      ) : grouped.length === 0 ? (
        <EmptySection section={activeSection} onNew={() => setCreating(true)} />
      ) : (
        <div className="flex flex-col gap-6">
          {grouped.map(({ status, items }) => (
            <div key={status}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ background: OPP_STATUS_STYLES[status].bg, color: OPP_STATUS_STYLES[status].fg }}
                >
                  {OPP_STATUS_STYLES[status].label}
                </span>
                <span className="text-xs" style={{ color: dashboardTheme.color.muted }}>
                  {items.length} {items.length === 1 ? 'opportunity' : 'opportunities'}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {items.map((opp) => (
                  <OppCard
                    key={opp.id}
                    opp={opp}
                    arcs={arcs}
                    onSaved={upsertOpp}
                    onDeleted={removeOpp}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySection({ section, onNew }: { section: OpportunitySection; onNew: () => void }) {
  const sectionDef = OPP_SECTIONS.find((s) => s.key === section)!;
  return (
    <div className="rounded-[24px] border-2 border-dashed px-6 py-14 text-center" style={{ borderColor: 'rgba(15,61,46,0.12)' }}>
      <p className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
        No {sectionDef.label.toLowerCase()} opportunities yet
      </p>
      <p className="mt-2 text-sm" style={{ color: dashboardTheme.color.muted }}>
        {sectionDef.description}
      </p>
      <button
        type="button"
        onClick={onNew}
        className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white"
        style={{ background: dashboardTheme.color.primary }}
      >
        + Add opportunity here
      </button>
    </div>
  );
}

// ─── Opportunity card ─────────────────────────────────────────────────────────

function OppCard({
  opp,
  arcs,
  onSaved,
  onDeleted,
}: {
  opp: StoryOpportunity;
  arcs: StoryArc[];
  onSaved: (o: StoryOpportunity) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const statusStyle = OPP_STATUS_STYLES[opp.status];
  const relatedArc = arcs.find((a) => a.id === opp.related_arc_id);

  async function quickStatus(status: OpportunityStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/story-opportunities/${opp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed');
      const saved: StoryOpportunity = await res.json();
      onSaved(saved);
      toast.success(`Moved to ${OPP_STATUS_STYLES[status].label}`);
    } catch {
      toast.error('Failed to update status');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <OppForm
        mode="edit"
        initial={opp}
        arcs={arcs}
        onSaved={(saved) => { onSaved(saved); setEditing(false); }}
        onCancel={() => setEditing(false)}
        onDeleted={() => onDeleted(opp.id)}
      />
    );
  }

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-5 py-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
                {opp.title}
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                style={{ background: statusStyle.bg, color: statusStyle.fg }}
              >
                {statusStyle.label}
              </span>
              <span
                className="rounded-full border px-2.5 py-0.5 text-[10px]"
                style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}
              >
                {OPP_SOURCE_LABELS[opp.source_type]}
              </span>
              {opp.is_auto_detected && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}
                >
                  Auto-detected
                </span>
              )}
              {opp.story_score !== null && opp.story_score !== undefined && (() => {
                const tier = getScoreTier(opp.story_score);
                return (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                    style={{ background: tier.bg, color: tier.fg }}
                    title={opp.score_reason ?? ''}
                  >
                    {opp.story_score} · {tier.label}
                  </span>
                );
              })()}
            </div>
            {!expanded && opp.content_angle && (
              <p className="mt-1 text-sm truncate" style={{ color: dashboardTheme.color.muted }}>
                {opp.content_angle}
              </p>
            )}
          </div>
          <span className="shrink-0 text-xs" style={{ color: dashboardTheme.color.muted }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-black/5 px-5 pb-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {opp.content_angle && (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: dashboardTheme.color.muted }}>
                  Content Angle
                </p>
                <p className="text-sm leading-6" style={{ color: dashboardTheme.color.text }}>
                  {opp.content_angle}
                </p>
              </div>
            )}

            {(opp.suggested_format || opp.suggested_platform) && (
              <div className="flex flex-wrap gap-4">
                {opp.suggested_format && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Format</p>
                    <p className="text-sm" style={{ color: dashboardTheme.color.text }}>{opp.suggested_format}</p>
                  </div>
                )}
                {opp.suggested_platform && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>Platform</p>
                    <p className="text-sm" style={{ color: dashboardTheme.color.text }}>{opp.suggested_platform}</p>
                  </div>
                )}
              </div>
            )}

            {(relatedArc || opp.related_characters.length > 0) && (
              <div>
                {relatedArc && (
                  <p className="text-[11px] mb-1" style={{ color: dashboardTheme.color.muted }}>
                    ↳ {relatedArc.title}
                  </p>
                )}
                {opp.related_characters.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {opp.related_characters.map((c) => (
                      <span key={c} className="rounded-full border px-2.5 py-1 text-[11px]"
                        style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {opp.notes && (
            <div className="mt-4 rounded-xl px-4 py-3" style={{ background: '#F8FAFC' }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: dashboardTheme.color.muted }}>Notes</p>
              <p className="whitespace-pre-wrap text-sm leading-6" style={{ color: dashboardTheme.color.text }}>{opp.notes}</p>
            </div>
          )}

          {opp.is_auto_detected && (
            <div className="mt-4 rounded-xl border px-4 py-3" style={{ background: '#F0F9FF', borderColor: 'rgba(59,130,246,0.15)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: '#1D4ED8' }}>
                    Detection metadata
                  </p>
                  <p className="text-xs leading-5" style={{ color: '#1E3A8A' }}>
                    <strong>Rule:</strong> {opp.detection_rule ?? '—'}
                  </p>
                  {opp.detection_reason && (
                    <p className="text-xs leading-5 mt-0.5" style={{ color: '#1E3A8A' }}>
                      <strong>Reason:</strong> {opp.detection_reason}
                    </p>
                  )}
                </div>
                {opp.confidence_score !== null && opp.confidence_score !== undefined && (
                  <span
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={
                      opp.confidence_score >= 0.8
                        ? { background: '#ECFDF5', color: '#047857' }
                        : opp.confidence_score >= 0.6
                        ? { background: '#FFFBEB', color: '#B45309' }
                        : { background: '#F1F5F9', color: '#475569' }
                    }
                  >
                    {Math.round(opp.confidence_score * 100)}% confidence
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick status transitions */}
          {opp.status !== 'published' && opp.status !== 'passed' && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/dashboard/content-studio/ideas?opportunity_id=${opp.id}`}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                style={{ background: '#ECFDF5', color: '#047857' }}
              >
                Capture content idea
              </Link>
              {opp.status === 'new' && (
                <button type="button" onClick={() => quickStatus('in_development')} disabled={saving}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                  style={{ background: '#EFF6FF', color: '#1D4ED8' }}>
                  → In Development
                </button>
              )}
              {opp.status === 'in_development' && (
                <button type="button" onClick={() => quickStatus('published')} disabled={saving}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
                  style={{ background: '#F1F5F9', color: '#475569' }}>
                  → Published
                </button>
              )}
              <button type="button" onClick={() => quickStatus('passed')} disabled={saving}
                className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50"
                style={{ color: '#B91C1C' }}>
                Pass
              </button>
            </div>
          )}

          <DraftsPanel
            oppId={opp.id}
            defaultFormat={opp.suggested_format}
            defaultPlatform={opp.suggested_platform}
          />

          <div className="mt-4 flex items-center justify-between">
            <p className="text-[11px] font-mono" style={{ color: dashboardTheme.color.muted, opacity: 0.65 }}>
              Created {formatTimestamp(opp.created_at)}
            </p>
            <button type="button" onClick={() => setEditing(true)}
              className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Opportunity form (new + edit) ────────────────────────────────────────────

function OppForm({
  mode,
  initial,
  defaultSection,
  arcs,
  onSaved,
  onCancel,
  onDeleted,
}: {
  mode: 'new' | 'edit';
  initial?: StoryOpportunity;
  defaultSection?: OpportunitySection;
  arcs: StoryArc[];
  onSaved: (o: StoryOpportunity) => void;
  onCancel: () => void;
  onDeleted?: () => void;
}) {
  const [draft, setDraft] = useState<OppDraft>(() =>
    initial ? oppToDraft(initial) : emptyDraft(defaultSection ?? 'surfaced'),
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function update<K extends keyof OppDraft>(key: K, value: OppDraft[K]) {
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
      const payload = {
        ...draft,
        source_ref_id:  draft.source_ref_id || null,
        related_arc_id: draft.related_arc_id || null,
      };
      const url    = mode === 'new' ? '/api/story-opportunities' : `/api/story-opportunities/${initial!.id}`;
      const method = mode === 'new' ? 'POST' : 'PUT';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Save failed');
      }
      const saved: StoryOpportunity = await res.json();
      onSaved(saved);
      toast.success(mode === 'new' ? 'Opportunity created' : 'Opportunity saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteOpp() {
    if (!initial?.id) return;
    if (!window.confirm('Delete this opportunity? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/story-opportunities/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Opportunity deleted');
      onDeleted?.();
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-[24px] border-2 border-black/8 bg-white/95 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <p className="mb-4 text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
        {mode === 'new' ? 'New Story Opportunity' : `Editing: ${initial?.title}`}
      </p>

      <div className="flex flex-col gap-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Title *
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="What is the content opportunity?"
            autoFocus={mode === 'new'}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Section + Status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Section
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OPP_SECTIONS.map((s) => {
                const isOn = draft.section === s.key;
                return (
                  <button key={s.key} type="button" onClick={() => update('section', s.key)}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold transition"
                    style={isOn
                      ? { background: '#ECFDF5', color: '#047857', boxShadow: 'inset 0 0 0 1.5px #10B981' }
                      : { background: '#F8FAFC', color: '#94A3B8' }}>
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OPP_STATUSES.map((s) => {
                const st = OPP_STATUS_STYLES[s];
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
        </div>

        {/* Source */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Source Type
            </label>
            <select
              value={draft.source_type}
              onChange={(e) => update('source_type', e.target.value as OpportunitySourceType)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
            >
              {SOURCE_TYPES.map((s) => (
                <option key={s} value={s}>{OPP_SOURCE_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {draft.source_type !== 'manual' && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
                Source Reference ID
              </label>
              <input
                type="text"
                value={draft.source_ref_id}
                onChange={(e) => update('source_ref_id', e.target.value)}
                placeholder="ID from the source record"
                className="w-full rounded-xl border px-3 py-2 text-sm font-mono"
                style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              />
            </div>
          )}
        </div>

        {/* Content angle */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Content Angle
          </label>
          <textarea
            value={draft.content_angle}
            onChange={(e) => update('content_angle', e.target.value)}
            rows={4}
            placeholder="What is the story angle? What makes this worth turning into content? What tension or insight does it capture?"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Format + Platform */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Suggested Format
            </label>
            <select
              value={draft.suggested_format}
              onChange={(e) => update('suggested_format', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: draft.suggested_format ? dashboardTheme.color.text : dashboardTheme.color.muted }}
            >
              <option value="">Not specified</option>
              {SUGGESTED_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
              Suggested Platform
            </label>
            <select
              value={draft.suggested_platform}
              onChange={(e) => update('suggested_platform', e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: draft.suggested_platform ? dashboardTheme.color.text : dashboardTheme.color.muted }}
            >
              <option value="">Not specified</option>
              {SUGGESTED_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Related Arc */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Related Arc
          </label>
          <select
            value={draft.related_arc_id}
            onChange={(e) => update('related_arc_id', e.target.value)}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: draft.related_arc_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">None</option>
            {arcs.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </div>

        {/* Characters */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Related Characters
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CHARACTER_OPTIONS.map((c) => {
              const isOn = draft.related_characters.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCharacter(c)}
                  className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                  style={isOn
                    ? { background: '#ECFDF5', borderColor: '#10B981', color: '#047857' }
                    : { borderColor: 'rgba(15,61,46,0.15)', color: dashboardTheme.color.muted }}>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority */}
        <div className="w-32">
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Priority (lower = higher)
          </label>
          <input
            type="number"
            value={draft.priority}
            onChange={(e) => update('priority', Number(e.target.value))}
            min={0}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
            Notes
          </label>
          <textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={3}
            placeholder="Additional context, timing considerations, or development notes…"
            className="w-full resize-y rounded-xl border px-3 py-2.5 text-sm leading-6"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4">
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}>
            Cancel
          </button>
          {mode === 'edit' && (
            <button type="button" onClick={deleteOpp} disabled={deleting || saving}
              className="rounded-xl px-4 py-2 text-sm font-medium transition hover:bg-red-50"
              style={{ color: '#B91C1C' }}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}
        </div>
        <button type="button" onClick={save} disabled={saving}
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
          style={{ background: dashboardTheme.color.primary }}>
          {saving ? 'Saving…' : mode === 'new' ? 'Create Opportunity' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Drafts panel (inside expanded OppCard) ───────────────────────────────────

function DraftsPanel({
  oppId,
  defaultFormat,
  defaultPlatform,
}: {
  oppId: string;
  defaultFormat: string;
  defaultPlatform: string;
}) {
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [genFormat, setGenFormat] = useState(defaultFormat || SUGGESTED_FORMATS[0]);
  const [genPlatform, setGenPlatform] = useState(defaultPlatform || SUGGESTED_PLATFORMS[0]);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/story-drafts?opportunity_id=${oppId}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const loaded: StoryDraft[] = json.drafts ?? [];
      setDrafts(loaded);
      setActiveTab((prev) => prev ?? loaded[0]?.id ?? null);
    } catch {
      // silent — panel is secondary to the card
    } finally {
      setLoading(false);
    }
  }, [oppId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch('/api/story-drafts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: oppId, format: genFormat, platform: genPlatform }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Generation failed');
        return;
      }
      const newDraft = data as StoryDraft;
      setDrafts((prev) => [newDraft, ...prev]);
      setActiveTab(newDraft.id);
      toast.success('Draft generated');
    } catch {
      toast.error('Generation failed — check your connection and try again');
    } finally {
      setGenerating(false);
    }
  }

  function upsertDraft(updated: StoryDraft) {
    setDrafts((prev) => prev.map((d) => d.id === updated.id ? updated : d));
  }

  function removeDraft(id: string) {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (activeTab === id) setActiveTab(next[0]?.id ?? null);
      return next;
    });
  }

  const selectedDraft = drafts.find((d) => d.id === activeTab) ?? null;

  return (
    <div className="mt-5 border-t border-black/5 pt-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
        Story Drafts
      </p>

      {/* Generate controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={genFormat}
          onChange={(e) => setGenFormat(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-xs"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        >
          {SUGGESTED_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={genPlatform}
          onChange={(e) => setGenPlatform(e.target.value)}
          className="rounded-xl border px-2.5 py-1.5 text-xs"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        >
          {SUGGESTED_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary }}
        >
          {generating ? 'Generating…' : '+ Generate Draft'}
        </button>
        <span className="text-[10px]" style={{ color: dashboardTheme.color.muted }}>
          AI-generated · requires human review
        </span>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: dashboardTheme.color.muted }}>Loading drafts…</p>
      ) : drafts.length === 0 ? (
        <p className="text-xs" style={{ color: dashboardTheme.color.muted }}>No drafts yet. Generate one above.</p>
      ) : (
        <div>
          {/* Draft tabs */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {drafts.map((d, i) => {
              const isActive = d.id === activeTab;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setActiveTab(d.id)}
                  className="rounded-xl px-3 py-1.5 text-xs font-medium transition"
                  style={
                    isActive
                      ? { background: '#F0FDF4', color: '#047857', boxShadow: 'inset 0 0 0 1.5px #10B981' }
                      : { background: '#F8FAFC', color: dashboardTheme.color.muted }
                  }
                >
                  {d.format} #{drafts.length - i}
                  {d.is_ai_generated && <span className="ml-1 opacity-50">✦</span>}
                </button>
              );
            })}
          </div>

          {selectedDraft && (
            <DraftEditor
              key={selectedDraft.id}
              draft={selectedDraft}
              onUpdated={upsertDraft}
              onDeleted={removeDraft}
              onRegenerate={generate}
              generating={generating}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Draft editor (selected draft in DraftsPanel) ─────────────────────────────

function DraftEditor({
  draft,
  onUpdated,
  onDeleted,
  onRegenerate,
  generating,
}: {
  draft: StoryDraft;
  onUpdated: (d: StoryDraft) => void;
  onDeleted: (id: string) => void;
  onRegenerate: () => void;
  generating: boolean;
}) {
  const [hook, setHook] = useState(draft.hook);
  const [body, setBody] = useState(draft.body);
  const [close, setClose] = useState(draft.close);
  const [hashtagsRaw, setHashtagsRaw] = useState(draft.hashtags.join(' '));
  const [status, setStatus] = useState<DraftStatus>(draft.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const contentChanged =
    hook !== draft.hook ||
    body !== draft.body ||
    close !== draft.close ||
    hashtagsRaw.trim() !== draft.hashtags.join(' ');

  const isDirty = contentChanged || status !== draft.status;

  async function save() {
    setSaving(true);
    try {
      const hashtags = hashtagsRaw
        .split(/[\s,]+/)
        .map((t) => t.replace(/^#/, ''))
        .filter(Boolean);

      const payload: Record<string, unknown> = { hook, body, close, hashtags, status };
      if (contentChanged) payload.is_ai_generated = false;

      const res = await fetch(`/api/story-drafts/${draft.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Save failed');
      }
      const saved = (await res.json()) as StoryDraft;
      onUpdated(saved);
      toast.success('Draft saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!window.confirm('Delete this draft? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/story-drafts/${draft.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Draft deleted');
      onDeleted(draft.id);
    } catch {
      toast.error('Failed to delete draft');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-[20px] border border-black/5 p-4" style={{ background: '#F8FAFC' }}>
      {/* Draft header */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: dashboardTheme.color.muted }}>
          {draft.format} · {draft.platform}
        </span>
        {draft.is_ai_generated && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: '#EFF6FF', color: '#1D4ED8' }}
          >
            AI-generated
          </span>
        )}
        {draft.generation_model && (
          <span className="text-[10px] font-mono opacity-50" style={{ color: dashboardTheme.color.muted }}>
            {draft.generation_model}
          </span>
        )}

        {/* Status selector */}
        <div className="ml-auto flex flex-wrap gap-1">
          {DRAFT_STATUSES.map((s) => {
            const st = DRAFT_STATUS_STYLES[s];
            const isOn = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition"
                style={
                  isOn
                    ? { background: st.bg, color: st.fg, boxShadow: `inset 0 0 0 1px ${st.fg}` }
                    : { background: '#F1F5F9', color: '#CBD5E1' }
                }
              >
                {st.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hook */}
      <div className="mb-3">
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Hook
        </label>
        <textarea
          value={hook}
          onChange={(e) => setHook(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm leading-6"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </div>

      {/* Body */}
      <div className="mb-3">
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm leading-6"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </div>

      {/* Close */}
      <div className="mb-3">
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Close / CTA
        </label>
        <textarea
          value={close}
          onChange={(e) => setClose(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-xl border bg-white px-3 py-2 text-sm leading-6"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </div>

      {/* Hashtags */}
      <div className="mb-4">
        <label
          className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Hashtags (space or comma separated, no # needed)
        </label>
        <input
          type="text"
          value={hashtagsRaw}
          onChange={(e) => setHashtagsRaw(e.target.value)}
          className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          placeholder="cleaning brisbane localservices"
        />
      </div>

      {/* Safety review */}
      <ReviewPanel draftId={draft.id} />

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={generating}
          className="rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-slate-100"
          style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
        >
          {generating ? 'Generating…' : 'Regenerate'}
        </button>
        <button
          type="button"
          onClick={deleteDraft}
          disabled={deleting || saving}
          className="ml-auto rounded-xl px-3 py-2 text-sm font-medium transition hover:bg-red-50"
          style={{ color: '#B91C1C' }}
        >
          {deleting ? 'Deleting…' : 'Delete draft'}
        </button>
      </div>

      <p className="mt-3 font-mono text-[10px] opacity-50" style={{ color: dashboardTheme.color.muted }}>
        Created {new Date(draft.created_at).toLocaleString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })}
        {draft.generation_tokens ? ` · ${draft.generation_tokens.toLocaleString()} tokens` : ''}
      </p>
    </div>
  );
}

// ─── Review panel (safety & approval layer for a draft) ──────────────────────

const REVIEW_STATUS_STYLES: Record<string, { bg: string; fg: string; label: string }> = {
  pending_review:    { bg: '#F1F5F9', fg: '#475569', label: 'Pending Review' },
  changes_required:  { bg: '#FFFBEB', fg: '#B45309', label: 'Changes Required' },
  approved:          { bg: '#ECFDF5', fg: '#047857', label: 'Approved' },
  rejected:          { bg: '#FEF2F2', fg: '#B91C1C', label: 'Rejected' },
};

const CATEGORY_LABELS: Record<string, string> = {
  privacy:  'Privacy',
  brand:    'Brand',
  factual:  'Factual',
  consent:  'Consent',
};

const SEVERITY_STYLES: Record<string, { dot: string; text: string }> = {
  blocker: { dot: '#B91C1C', text: '#B91C1C' },
  warning: { dot: '#B45309', text: '#B45309' },
  info:    { dot: '#1D4ED8', text: '#475569' },
};

interface ReviewFinding {
  category: string;
  severity: string;
  message:  string;
}

interface StoryReview {
  id: string;
  draft_id: string;
  review_status: string;
  safety_score: number;
  consent_verified: boolean;
  privacy_checked: boolean;
  factual_accuracy_checked: boolean;
  brand_alignment_checked: boolean;
  findings: ReviewFinding[];
  reviewer_notes: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function ScoreBadge({ score }: { score: number }) {
  const bg  = score >= 80 ? '#ECFDF5' : score >= 50 ? '#FFFBEB' : '#FEF2F2';
  const fg  = score >= 80 ? '#047857' : score >= 50 ? '#B45309' : '#B91C1C';
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: bg, color: fg }}
    >
      {score}/100
    </span>
  );
}

function ReviewPanel({ draftId }: { draftId: string }) {
  const [reviews, setReviews]     = useState<StoryReview[]>([]);
  const [running, setRunning]     = useState(false);
  const [loadingR, setLoadingR]   = useState(true);
  const [notesDraft, setNotesDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const latest = reviews[0] ?? null;

  const findings: ReviewFinding[] = Array.isArray(latest?.findings) ? latest.findings : [];

  const hasApproved = reviews.some(
    (r) =>
      r.review_status === 'approved' &&
      r.consent_verified &&
      r.privacy_checked &&
      r.factual_accuracy_checked &&
      r.brand_alignment_checked,
  );

  const loadReviews = useCallback(async () => {
    setLoadingR(true);
    try {
      const res = await fetch(`/api/story-reviews?draft_id=${draftId}`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      const loaded: StoryReview[] = json.reviews ?? [];
      setReviews(loaded);
      setNotesDraft(loaded[0]?.reviewer_notes ?? '');
    } catch {
      // silent — secondary panel
    } finally {
      setLoadingR(false);
    }
  }, [draftId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  async function runReview() {
    setRunning(true);
    try {
      const res = await fetch('/api/story-reviews/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft_id: draftId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Review failed'); return; }
      await loadReviews();
      toast.success('Safety review complete');
    } catch {
      toast.error('Review failed — check connection');
    } finally {
      setRunning(false);
    }
  }

  async function updateStatus(newStatus: string) {
    if (!latest) return;
    try {
      const res = await fetch(`/api/story-reviews/${latest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: newStatus }),
      });
      if (!res.ok) { toast.error('Failed to update status'); return; }
      await loadReviews();
      toast.success(`Marked as ${REVIEW_STATUS_STYLES[newStatus]?.label ?? newStatus}`);
    } catch {
      toast.error('Failed to update review');
    }
  }

  async function saveNote() {
    if (!latest) return;
    setSavingNote(true);
    try {
      const res = await fetch(`/api/story-reviews/${latest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewer_notes: notesDraft }),
      });
      if (!res.ok) { toast.error('Failed to save notes'); return; }
      await loadReviews();
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setSavingNote(false);
    }
  }

  // Group findings by category
  const byCategory: Record<string, ReviewFinding[]> = {};
  for (const f of findings) {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  }

  return (
    <div
      className="mt-4 rounded-[20px] border p-4"
      style={{ background: '#FAFBFD', borderColor: 'rgba(0,0,0,0.07)' }}
    >
      {/* Panel header */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: dashboardTheme.color.muted }}
        >
          Safety Review
        </p>
        {latest && <ScoreBadge score={latest.safety_score} />}
        {latest && (() => {
          const st = REVIEW_STATUS_STYLES[latest.review_status];
          return st ? (
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
              style={{ background: st.bg, color: st.fg }}
            >
              {st.label}
            </span>
          ) : null;
        })()}
        <button
          type="button"
          onClick={runReview}
          disabled={running}
          className="ml-auto rounded-xl px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary }}
        >
          {running ? 'Running…' : latest ? 'Re-run Review' : 'Run Safety Review'}
        </button>
      </div>

      {/* Loading */}
      {loadingR && (
        <p className="text-xs" style={{ color: dashboardTheme.color.muted }}>Loading reviews…</p>
      )}

      {/* No review yet */}
      {!loadingR && !latest && (
        <p className="text-xs" style={{ color: dashboardTheme.color.muted }}>
          No safety review yet. Run one before publishing.
        </p>
      )}

      {/* Latest review detail */}
      {!loadingR && latest && (
        <>
          {/* Check badges */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              { key: 'privacy_checked',          label: 'Privacy'  },
              { key: 'consent_verified',         label: 'Consent'  },
              { key: 'factual_accuracy_checked', label: 'Factual'  },
              { key: 'brand_alignment_checked',  label: 'Brand'    },
            ].map(({ key, label }) => {
              const passed = (latest as unknown as Record<string, boolean>)[key];
              return (
                <span
                  key={key}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={
                    passed
                      ? { background: '#ECFDF5', color: '#047857' }
                      : { background: '#FEF2F2', color: '#B91C1C' }
                  }
                >
                  {passed ? '✓' : '✕'} {label}
                </span>
              );
            })}
          </div>

          {/* Findings grouped by category */}
          {findings.length > 0 && (
            <div className="mb-3 space-y-2">
              {Object.entries(byCategory).map(([cat, catFindings]) => (
                <div key={cat}>
                  <p
                    className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                    style={{ color: dashboardTheme.color.muted }}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </p>
                  <ul className="space-y-1">
                    {catFindings.map((f, i) => {
                      const sty = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info;
                      return (
                        <li key={i} className="flex items-start gap-1.5">
                          <span
                            className="mt-[5px] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: sty.dot }}
                          />
                          <span className="text-xs leading-5" style={{ color: sty.text }}>
                            {f.message}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {findings.length === 0 && (
            <p className="mb-3 text-xs" style={{ color: '#047857' }}>
              No issues found in this review pass.
            </p>
          )}

          {/* Reviewer notes textarea */}
          <div className="mb-3">
            <label
              className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{ color: dashboardTheme.color.muted }}
            >
              Reviewer Notes
            </label>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={saveNote}
              disabled={savingNote}
              rows={3}
              className="w-full resize-y rounded-xl border bg-white px-3 py-2 text-xs leading-5"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              placeholder="Add human review notes here…"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateStatus('changes_required')}
              disabled={latest.review_status === 'changes_required'}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
              style={{ background: '#FFFBEB', color: '#B45309' }}
            >
              Changes Required
            </button>
            <button
              type="button"
              onClick={() => updateStatus('approved')}
              disabled={latest.review_status === 'approved'}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
              style={{ background: '#ECFDF5', color: '#047857' }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => updateStatus('rejected')}
              disabled={latest.review_status === 'rejected'}
              className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
              style={{ background: '#FEF2F2', color: '#B91C1C' }}
            >
              Reject
            </button>
          </div>
        </>
      )}

      {/* Content Studio gate */}
      {!hasApproved && (
        <div
          className="mt-3 rounded-xl px-3 py-2.5"
          style={{ background: '#F1F5F9', borderLeft: '3px solid #CBD5E1' }}
        >
          <p className="text-xs font-medium" style={{ color: dashboardTheme.color.muted }}>
            Needs approval before Content Studio
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function NoAINote() {
  return (
    <div
      className="rounded-[20px] border px-4 py-3"
      style={{ background: '#F0FDF4', borderColor: 'rgba(16,185,129,0.2)' }}
    >
      <p className="text-[11px] font-semibold" style={{ color: '#065F46' }}>
        Detection scans real data — no AI generation, no mock opportunities.
      </p>
      <p className="mt-1 text-xs" style={{ color: '#047857' }}>
        Run Detection scans journal entries, orders, reviews, leads, subscriptions, and agent actions.
        Each rule fires at most once per source record. All content angles are Jackson's to develop.
      </p>
    </div>
  );
}
