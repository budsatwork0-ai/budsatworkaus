'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import { type ContentAsset } from '@/types/content-asset';
import { type ContentIdea } from '@/types/content-idea';
import { type ContentProductionCard } from '@/types/content-production';
import { type ContentScript } from '@/types/content-script';
import {
  PUBLISHING_PLATFORMS,
  PUBLISHING_QUEUE_STATUSES,
  PUBLISHING_QUEUE_STATUS_STYLES,
  type MarketingPublishingQueueItem,
  type PublishingPlatform,
  type PublishingQueueStatus,
} from '@/types/publishing-queue';
import { getScoreTier, type StoryArc, type StoryOpportunity } from '@/types/story-engine';

type QueueDraft = {
  production_card_id: string;
  title: string;
  platform: PublishingPlatform;
  format: string;
  related_arc_id: string;
  related_characters: string[];
  target_publish_at: string;
  status: PublishingQueueStatus;
  caption_placeholder: string;
  consent_verified: boolean;
  notes: string;
};

const STATUS_ORDER = PUBLISHING_QUEUE_STATUSES;

function emptyDraft(): QueueDraft {
  return {
    production_card_id: '',
    title: '',
    platform: 'instagram',
    format: '',
    related_arc_id: '',
    related_characters: [],
    target_publish_at: '',
    status: 'draft',
    caption_placeholder: '',
    consent_verified: false,
    notes: '',
  };
}

function normalizePlatform(value: string): PublishingPlatform {
  const clean = value.toLowerCase().trim();
  const found = PUBLISHING_PLATFORMS.find((item) => item.key === clean || item.label.toLowerCase() === clean);
  return found?.key ?? 'instagram';
}

function draftFromCard(card: ContentProductionCard): QueueDraft {
  return {
    production_card_id: card.id,
    title: card.title,
    platform: normalizePlatform(card.platform),
    format: card.format,
    related_arc_id: card.related_arc_id ?? '',
    related_characters: card.related_characters,
    target_publish_at: '',
    status: 'draft',
    caption_placeholder: '',
    consent_verified: false,
    notes: card.notes ? `Production notes:\n${card.notes}` : '',
  };
}

function formatDateTime(value: string | null) {
  if (!value) return 'No target time';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDatetimeLocal(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function MarketingPublishingPage() {
  const [items, setItems] = useState<MarketingPublishingQueueItem[]>([]);
  const [cards, setCards] = useState<ContentProductionCard[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [opps, setOpps] = useState<StoryOpportunity[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [draft, setDraft] = useState<QueueDraft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [qRes, cRes, sRes, iRes, aRes, oRes, arcRes] = await Promise.all([
        fetch('/api/publishing-queue'),
        fetch('/api/content-production'),
        fetch('/api/content-scripts'),
        fetch('/api/content-ideas'),
        fetch('/api/content-assets'),
        fetch('/api/story-opportunities'),
        fetch('/api/story-arcs'),
      ]);
      if (!qRes.ok || !cRes.ok) throw new Error('Failed to load publishing queue');
      const [qj, cj, sj, ij, aj, oj, arcj] = await Promise.all([
        qRes.json(),
        cRes.json(),
        sRes.json(),
        iRes.json(),
        aRes.json(),
        oRes.json(),
        arcRes.json(),
      ]);
      setItems(qj.items ?? []);
      setCards(cj.cards ?? []);
      setScripts(sj.scripts ?? []);
      setIdeas(ij.ideas ?? []);
      setAssets(aj.assets ?? []);
      setOpps(oj.opportunities ?? []);
      setArcs(arcj.arcs ?? []);
    } catch {
      setError('Could not load Marketing Studio Publishing Queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scriptById = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);
  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  const oppById = useMemo(() => new Map(opps.map((opp) => [opp.id, opp])), [opps]);
  const arcById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);
  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const deniedAssetsByCard = useMemo(() => {
    const map = new Map<string, ContentAsset[]>();
    assets.filter((asset) => asset.production_card_id && asset.consent_status === 'denied').forEach((asset) => {
      map.set(asset.production_card_id!, [...(map.get(asset.production_card_id!) ?? []), asset]);
    });
    return map;
  }, [assets]);

  const eligibleCards = useMemo(() => {
    return cards
      .filter((card) => {
        const script = scriptById.get(card.script_id);
        return card.status === 'ready_to_publish' && script?.status === 'approved' && !deniedAssetsByCard.has(card.id);
      })
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [cards, deniedAssetsByCard, scriptById]);

  function selectCard(cardId: string) {
    const card = cardById.get(cardId);
    setDraft(card ? draftFromCard(card) : emptyDraft());
  }

  async function createItem() {
    if (!draft.production_card_id) {
      toast.error('Ready to Publish production card is required');
      return;
    }
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/publishing-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          related_arc_id: draft.related_arc_id || null,
          target_publish_at: draft.target_publish_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create queue item');
        return;
      }
      setItems((prev) => [data as MarketingPublishingQueueItem, ...prev]);
      setDraft(emptyDraft());
      toast.success('Publishing queue item created');
    } catch {
      toast.error('Failed to create queue item');
    } finally {
      setSaving(false);
    }
  }

  function upsertItem(updated: MarketingPublishingQueueItem) {
    setItems((prev) => prev.map((item) => item.id === updated.id ? updated : item));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Marketing Studio"
        title="Publishing Queue"
        description="Manual bridge from Ready to Publish production cards into platform-specific queue items. Publishing is recorded by a person; no platform API calls run here."
        actions={
          <Link
            href="/dashboard/marketing"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            Marketing Overview
          </Link>
        }
      />

      <div className="rounded-[20px] border px-5 py-4" style={{ background: '#FFFBEB', borderColor: 'rgba(245,158,11,0.25)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>
          Phase 4A boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Queue items are created from Ready to Publish production cards only. Captions are placeholders, status changes are manual, and Published records a manual publish event only.
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
              <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Create queue item</h2>
              <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
                Start from a Ready to Publish production card and choose the manual platform target.
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
          <QueueForm
            draft={draft}
            setDraft={setDraft}
            cards={eligibleCards}
            arcs={arcs}
            saving={saving}
            submitLabel="Create queue item"
            onCardSelect={selectCard}
            onSubmit={createItem}
          />
        </section>

        <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Ready to Publish cards</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Eligible cards must have an approved script and no denied-consent linked assets.
            </p>
          </div>
          <div className="grid gap-3">
            {eligibleCards.length === 0 ? (
              <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
                No eligible production cards.
              </p>
            ) : eligibleCards.slice(0, 6).map((card) => {
              const script = scriptById.get(card.script_id);
              const idea = script ? ideaById.get(script.idea_id) : undefined;
              const opportunity = idea?.opportunity_id ? oppById.get(idea.opportunity_id) : undefined;
              const arc = card.related_arc_id ? arcById.get(card.related_arc_id) : undefined;
              return (
                <ReadyCard
                  key={card.id}
                  card={card}
                  script={script}
                  idea={idea}
                  opportunity={opportunity}
                  arc={arc}
                  onUse={() => setDraft(draftFromCard(card))}
                />
              );
            })}
          </div>
        </section>
      </div>

      <section className="grid gap-3 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const style = PUBLISHING_QUEUE_STATUS_STYLES[status];
          const statusItems = items
            .filter((item) => item.status === status)
            .sort((a, b) => (a.target_publish_at ?? '9999-12-31').localeCompare(b.target_publish_at ?? '9999-12-31'));
          return (
            <div key={status} className="rounded-[24px] border border-black/5 bg-white/80 p-3 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{style.label}</h2>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: style.bg, color: style.fg }}>
                  {statusItems.length}
                </span>
              </div>
              <div className="grid gap-3">
                {loading ? (
                  <p className="rounded-2xl border border-black/5 bg-white px-3 py-6 text-center text-xs" style={{ color: dashboardTheme.color.muted }}>
                    Loading...
                  </p>
                ) : statusItems.length === 0 ? (
                  <p className="rounded-2xl border border-black/5 bg-white px-3 py-6 text-center text-xs" style={{ color: dashboardTheme.color.muted }}>
                    No queue items
                  </p>
                ) : statusItems.map((item) => {
                  const card = cardById.get(item.production_card_id);
                  const script = card ? scriptById.get(card.script_id) : undefined;
                  const idea = script ? ideaById.get(script.idea_id) : undefined;
                  const opportunity = idea?.opportunity_id ? oppById.get(idea.opportunity_id) : undefined;
                  const arc = item.related_arc_id ? arcById.get(item.related_arc_id) : undefined;
                  return (
                    <QueueCard
                      key={item.id}
                      item={item}
                      productionCard={card}
                      script={script}
                      idea={idea}
                      opportunity={opportunity}
                      arc={arc}
                      eligibleCards={eligibleCards}
                      arcs={arcs}
                      onUpdated={upsertItem}
                      onDeleted={removeItem}
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

function ReadyCard({
  card,
  script,
  idea,
  opportunity,
  arc,
  onUse,
}: {
  card: ContentProductionCard;
  script?: ContentScript;
  idea?: ContentIdea;
  opportunity?: StoryOpportunity;
  arc?: StoryArc;
  onUse: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{card.title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5" style={{ color: dashboardTheme.color.muted }}>
            {script?.hook || script?.core_moment || 'Approved script ready for manual publishing queue.'}
          </p>
        </div>
        {opportunity?.story_score !== null && opportunity?.story_score !== undefined && <ScorePill score={opportunity.story_score} />}
      </div>
      <div className="mt-3 grid gap-1.5 text-xs" style={{ color: dashboardTheme.color.text }}>
        <p><strong>Idea:</strong> {idea?.title ?? 'No linked idea'}</p>
        <p><strong>Script:</strong> {script ? [script.hook, script.core_moment].filter(Boolean).join(' / ') || 'Approved script' : 'Missing script'}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {card.platform && <Chip>{card.platform}</Chip>}
        {card.format && <Chip>{card.format}</Chip>}
        {arc && <Chip>{arc.title}</Chip>}
      </div>
      <button
        type="button"
        onClick={onUse}
        className="mt-3 w-full rounded-xl px-3 py-2 text-xs font-semibold transition hover:opacity-90"
        style={{ background: '#ECFDF5', color: '#047857' }}
      >
        Use for queue
      </button>
    </div>
  );
}

function QueueCard({
  item,
  productionCard,
  script,
  idea,
  opportunity,
  arc,
  eligibleCards,
  arcs,
  onUpdated,
  onDeleted,
}: {
  item: MarketingPublishingQueueItem;
  productionCard?: ContentProductionCard;
  script?: ContentScript;
  idea?: ContentIdea;
  opportunity?: StoryOpportunity;
  arc?: StoryArc;
  eligibleCards: ContentProductionCard[];
  arcs: StoryArc[];
  onUpdated: (item: MarketingPublishingQueueItem) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<QueueDraft>(() => itemToDraft(item));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(itemToDraft(item));
  }, [item, editing]);

  async function save(next?: Partial<QueueDraft>) {
    const payload = { ...draft, ...next };
    setSaving(true);
    try {
      const res = await fetch(`/api/publishing-queue/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          related_arc_id: payload.related_arc_id || null,
          target_publish_at: payload.target_publish_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update queue item');
        return;
      }
      onUpdated(data as MarketingPublishingQueueItem);
      setEditing(false);
      toast.success('Publishing queue item updated');
    } catch {
      toast.error('Failed to update queue item');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this publishing queue item? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/publishing-queue/${item.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(item.id);
      toast.success('Publishing queue item deleted');
    } catch {
      toast.error('Failed to delete queue item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4">
      {editing ? (
        <div>
          <QueueForm
            draft={draft}
            setDraft={setDraft}
            cards={eligibleCards.some((card) => card.id === item.production_card_id) ? eligibleCards : productionCard ? [productionCard, ...eligibleCards] : eligibleCards}
            arcs={arcs}
            saving={saving}
            submitLabel="Save queue item"
            onCardSelect={(id) => {
              const card = eligibleCards.find((candidate) => candidate.id === id) ?? productionCard;
              setDraft(card ? draftFromCard(card) : { ...draft, production_card_id: '' });
            }}
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
            Delete queue item
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{item.title}</h3>
              <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {formatDateTime(item.target_publish_at)}
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

          {!item.consent_verified && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              Consent not verified. This item cannot move to Ready or Published.
            </div>
          )}

          <div className="mt-3 grid gap-2 text-xs" style={{ color: dashboardTheme.color.text }}>
            <p><strong>Production:</strong> {productionCard?.title ?? 'Missing production card'}</p>
            <p><strong>Script summary:</strong> {script ? [script.hook, script.core_moment, script.close_cta].filter(Boolean).join(' / ') || 'Approved script' : 'Missing script'}</p>
            <p><strong>Idea:</strong> {idea?.title ?? 'No linked idea'}</p>
            <p><strong>Platform:</strong> {PUBLISHING_PLATFORMS.find((platform) => platform.key === item.platform)?.label ?? item.platform}</p>
            <p><strong>Format:</strong> {item.format || 'Not set'}</p>
            <p><strong>Arc:</strong> {arc?.title ?? 'No arc linked'}</p>
            <p><strong>Characters:</strong> {item.related_characters.length > 0 ? item.related_characters.join(', ') : 'None'}</p>
            <p>
              <strong>Opportunity:</strong>{' '}
              {opportunity?.story_score !== null && opportunity?.story_score !== undefined ? <ScorePill score={opportunity.story_score} /> : 'No score'}
            </p>
            {item.caption_placeholder && <p className="whitespace-pre-wrap"><strong>Caption placeholder:</strong> {item.caption_placeholder}</p>}
            {item.notes && <p className="whitespace-pre-wrap"><strong>Notes:</strong> {item.notes}</p>}
            {item.published_at && <p><strong>Published manually:</strong> {formatDateTime(item.published_at)}</p>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_ORDER.filter((status) => status !== item.status).map((status) => {
              const style = PUBLISHING_QUEUE_STATUS_STYLES[status];
              const blocked = (status === 'ready' || status === 'published') && !item.consent_verified;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => save({ status })}
                  disabled={saving || blocked}
                  className="rounded-full px-2 py-1 text-[10px] font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ background: style.bg, color: style.fg }}
                  title={blocked ? 'Verify consent before moving to Ready or Published' : undefined}
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

function itemToDraft(item: MarketingPublishingQueueItem): QueueDraft {
  return {
    production_card_id: item.production_card_id,
    title: item.title,
    platform: item.platform,
    format: item.format,
    related_arc_id: item.related_arc_id ?? '',
    related_characters: item.related_characters,
    target_publish_at: toDatetimeLocal(item.target_publish_at),
    status: item.status,
    caption_placeholder: item.caption_placeholder,
    consent_verified: item.consent_verified,
    notes: item.notes,
  };
}

function QueueForm({
  draft,
  setDraft,
  cards,
  arcs,
  saving,
  submitLabel,
  onCardSelect,
  onSubmit,
  onCancel,
}: {
  draft: QueueDraft;
  setDraft: (draft: QueueDraft) => void;
  cards: ContentProductionCard[];
  arcs: StoryArc[];
  saving: boolean;
  submitLabel: string;
  onCardSelect: (id: string) => void;
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
      <label>
        <Label>Ready production card</Label>
        <select
          value={draft.production_card_id}
          onChange={(e) => onCardSelect(e.target.value)}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: draft.production_card_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
        >
          <option value="">Select production card</option>
          {cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
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
          <select
            value={draft.platform}
            onChange={(e) => setDraft({ ...draft, platform: e.target.value as PublishingPlatform })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {PUBLISHING_PLATFORMS.map((platform) => <option key={platform.key} value={platform.key}>{platform.label}</option>)}
          </select>
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
          <Label>Target publish time</Label>
          <input
            type="datetime-local"
            value={draft.target_publish_at}
            onChange={(e) => setDraft({ ...draft, target_publish_at: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as PublishingQueueStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{PUBLISHING_QUEUE_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 rounded-xl border px-3 py-2" style={{ borderColor: dashboardTheme.color.border }}>
          <input
            type="checkbox"
            checked={draft.consent_verified}
            onChange={(e) => setDraft({ ...draft, consent_verified: e.target.checked })}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium" style={{ color: dashboardTheme.color.text }}>Consent verified</span>
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
        <Label>Caption placeholder</Label>
        <textarea
          value={draft.caption_placeholder}
          onChange={(e) => setDraft({ ...draft, caption_placeholder: e.target.value })}
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
          {saving ? 'Saving...' : submitLabel}
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

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
      {children}
    </span>
  );
}

function Chip({ children }: { children: ReactNode }) {
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
      {score} - {tier.label}
    </span>
  );
}
