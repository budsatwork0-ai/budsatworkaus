'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  MARKETING_CAMPAIGN_CHANNELS,
  MARKETING_CAMPAIGN_STATUSES,
  MARKETING_CAMPAIGN_STATUS_STYLES,
  type MarketingCampaignKpis,
  type MarketingCampaignStatus,
  type MarketingCampaignWithQueueItems,
} from '@/types/marketing-campaign';
import { type MarketingPublishingQueueItem, PUBLISHING_PLATFORMS } from '@/types/publishing-queue';
import { type StoryArc } from '@/types/story-engine';

type CampaignDraft = {
  name: string;
  goal: string;
  related_arc_id: string;
  target_audience: string;
  channels: string[];
  linked_publishing_queue_items: string[];
  start_date: string;
  end_date: string;
  status: MarketingCampaignStatus;
  kpis_text: string;
  result_summary: string;
  notes: string;
};

const STATUS_ORDER = MARKETING_CAMPAIGN_STATUSES;

function emptyDraft(): CampaignDraft {
  return {
    name: '',
    goal: '',
    related_arc_id: '',
    target_audience: '',
    channels: [],
    linked_publishing_queue_items: [],
    start_date: '',
    end_date: '',
    status: 'planning',
    kpis_text: '{}',
    result_summary: '',
    notes: '',
  };
}

function campaignToDraft(campaign: MarketingCampaignWithQueueItems): CampaignDraft {
  return {
    name: campaign.name,
    goal: campaign.goal,
    related_arc_id: campaign.related_arc_id ?? '',
    target_audience: campaign.target_audience,
    channels: campaign.channels,
    linked_publishing_queue_items: campaign.linked_publishing_queue_items,
    start_date: campaign.start_date ?? '',
    end_date: campaign.end_date ?? '',
    status: campaign.status,
    kpis_text: JSON.stringify(campaign.kpis ?? {}, null, 2),
    result_summary: campaign.result_summary,
    notes: campaign.notes,
  };
}

function parseKpis(text: string): MarketingCampaignKpis | null {
  try {
    const value = JSON.parse(text || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as MarketingCampaignKpis;
  } catch {
    return null;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'No date';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<MarketingCampaignWithQueueItems[]>([]);
  const [queueItems, setQueueItems] = useState<MarketingPublishingQueueItem[]>([]);
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [draft, setDraft] = useState<CampaignDraft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [cRes, qRes, aRes] = await Promise.all([
        fetch('/api/marketing-campaigns'),
        fetch('/api/publishing-queue'),
        fetch('/api/story-arcs'),
      ]);
      if (!cRes.ok || !qRes.ok) throw new Error('Failed to load campaign manager');
      const [cj, qj, aj] = await Promise.all([cRes.json(), qRes.json(), aRes.json()]);
      setCampaigns(cj.campaigns ?? []);
      setQueueItems(qj.items ?? []);
      setArcs(aj.arcs ?? []);
    } catch {
      setError('Could not load Marketing Campaign Manager.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const arcById = useMemo(() => new Map(arcs.map((arc) => [arc.id, arc])), [arcs]);

  async function createCampaign() {
    if (!draft.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    const kpis = parseKpis(draft.kpis_text);
    if (!kpis) {
      toast.error('KPIs must be a JSON object');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/marketing-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(draft, kpis)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create campaign');
        return;
      }
      setCampaigns((prev) => [data as MarketingCampaignWithQueueItems, ...prev]);
      setDraft(emptyDraft());
      toast.success('Campaign created');
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setSaving(false);
    }
  }

  function upsertCampaign(updated: MarketingCampaignWithQueueItems) {
    setCampaigns((prev) => prev.map((campaign) => campaign.id === updated.id ? updated : campaign));
  }

  function removeCampaign(id: string) {
    setCampaigns((prev) => prev.filter((campaign) => campaign.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Marketing Studio"
        title="Campaign Manager"
        description="Manual campaign planning linked to existing Publishing Queue items. This does not auto-post, generate summaries, run analytics automation, or call channel APIs."
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
          Phase 4B boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Campaigns organize goals, audiences, channels, KPIs, notes, and existing queue items. Results and KPIs are entered manually.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Create campaign</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Link queue items that already exist. No campaign action publishes content.
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
        <CampaignForm
          draft={draft}
          setDraft={setDraft}
          arcs={arcs}
          queueItems={queueItems}
          saving={saving}
          submitLabel="Create campaign"
          onSubmit={createCampaign}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-4">
        {STATUS_ORDER.map((status) => {
          const style = MARKETING_CAMPAIGN_STATUS_STYLES[status];
          const items = campaigns
            .filter((campaign) => campaign.status === status)
            .sort((a, b) => (a.start_date ?? '9999-12-31').localeCompare(b.start_date ?? '9999-12-31'));
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
                    Loading...
                  </p>
                ) : items.length === 0 ? (
                  <p className="rounded-2xl border border-black/5 bg-white px-3 py-6 text-center text-xs" style={{ color: dashboardTheme.color.muted }}>
                    No campaigns
                  </p>
                ) : items.map((campaign) => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    arc={campaign.related_arc_id ? arcById.get(campaign.related_arc_id) : undefined}
                    arcs={arcs}
                    queueItems={queueItems}
                    onUpdated={upsertCampaign}
                    onDeleted={removeCampaign}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

function CampaignCard({
  campaign,
  arc,
  arcs,
  queueItems,
  onUpdated,
  onDeleted,
}: {
  campaign: MarketingCampaignWithQueueItems;
  arc?: StoryArc;
  arcs: StoryArc[];
  queueItems: MarketingPublishingQueueItem[];
  onUpdated: (campaign: MarketingCampaignWithQueueItems) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CampaignDraft>(() => campaignToDraft(campaign));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(campaignToDraft(campaign));
  }, [campaign, editing]);

  async function save(next?: Partial<CampaignDraft>) {
    const payloadDraft = { ...draft, ...next };
    const kpis = parseKpis(payloadDraft.kpis_text);
    if (!kpis) {
      toast.error('KPIs must be a JSON object');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/marketing-campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(payloadDraft, kpis)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update campaign');
        return;
      }
      onUpdated(data as MarketingCampaignWithQueueItems);
      setEditing(false);
      toast.success('Campaign updated');
    } catch {
      toast.error('Failed to update campaign');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this campaign? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/marketing-campaigns/${campaign.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(campaign.id);
      toast.success('Campaign deleted');
    } catch {
      toast.error('Failed to delete campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4">
      {editing ? (
        <div>
          <CampaignForm
            draft={draft}
            setDraft={setDraft}
            arcs={arcs}
            queueItems={queueItems}
            saving={saving}
            submitLabel="Save campaign"
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
            Delete campaign
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{campaign.name}</h3>
              <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {formatDate(campaign.start_date)} - {formatDate(campaign.end_date)}
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
            <p><strong>Goal:</strong> {campaign.goal || 'Not set'}</p>
            <p><strong>Audience:</strong> {campaign.target_audience || 'Not set'}</p>
            <p><strong>Arc:</strong> {arc?.title ?? 'No arc linked'}</p>
            <p><strong>Queue items:</strong> {campaign.queue_items.length}</p>
            {campaign.result_summary && <p className="whitespace-pre-wrap"><strong>Result summary:</strong> {campaign.result_summary}</p>}
            {campaign.notes && <p className="whitespace-pre-wrap"><strong>Notes:</strong> {campaign.notes}</p>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {campaign.channels.map((channel) => <Chip key={channel}>{channel}</Chip>)}
            {Object.entries(campaign.kpis ?? {}).map(([key, value]) => <Chip key={key}>{key}: {String(value)}</Chip>)}
          </div>

          {campaign.queue_items.length > 0 && (
            <div className="mt-3 grid gap-1.5">
              {campaign.queue_items.slice(0, 4).map((item) => (
                <p key={item.id} className="rounded-xl bg-slate-50 px-3 py-2 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                  {item.title} - {item.platform} - {item.status}
                </p>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_ORDER.filter((status) => status !== campaign.status).map((status) => {
              const style = MARKETING_CAMPAIGN_STATUS_STYLES[status];
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

function CampaignForm({
  draft,
  setDraft,
  arcs,
  queueItems,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: CampaignDraft;
  setDraft: (draft: CampaignDraft) => void;
  arcs: StoryArc[];
  queueItems: MarketingPublishingQueueItem[];
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  function toggleChannel(channel: string) {
    setDraft({
      ...draft,
      channels: draft.channels.includes(channel)
        ? draft.channels.filter((item) => item !== channel)
        : [...draft.channels, channel],
    });
  }

  function toggleQueueItem(id: string) {
    setDraft({
      ...draft,
      linked_publishing_queue_items: draft.linked_publishing_queue_items.includes(id)
        ? draft.linked_publishing_queue_items.filter((item) => item !== id)
        : [...draft.linked_publishing_queue_items, id],
    });
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Name</Label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as MarketingCampaignStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{MARKETING_CAMPAIGN_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Goal</Label>
        <textarea
          value={draft.goal}
          onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
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
          <Label>Target audience</Label>
          <input
            value={draft.target_audience}
            onChange={(e) => setDraft({ ...draft, target_audience: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Start date</Label>
          <input
            type="date"
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>End date</Label>
          <input
            type="date"
            value={draft.end_date}
            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
      </div>

      <div>
        <Label>Channels</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {MARKETING_CAMPAIGN_CHANNELS.map((channel) => (
            <button
              key={channel}
              type="button"
              onClick={() => toggleChannel(channel)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
              style={{
                borderColor: draft.channels.includes(channel) ? '#047857' : 'rgba(15,61,46,0.12)',
                background: draft.channels.includes(channel) ? '#ECFDF5' : '#fff',
                color: draft.channels.includes(channel) ? '#047857' : dashboardTheme.color.muted,
              }}
            >
              {PUBLISHING_PLATFORMS.find((platform) => platform.key === channel)?.label ?? channel}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Linked publishing queue items</Label>
        <div className="mt-2 grid max-h-56 gap-2 overflow-auto rounded-xl border p-2" style={{ borderColor: dashboardTheme.color.border }}>
          {queueItems.length === 0 ? (
            <p className="px-2 py-3 text-xs" style={{ color: dashboardTheme.color.muted }}>No queue items available.</p>
          ) : queueItems.map((item) => (
            <label key={item.id} className="flex items-start gap-2 rounded-lg px-2 py-2 text-xs hover:bg-slate-50" style={{ color: dashboardTheme.color.text }}>
              <input
                type="checkbox"
                checked={draft.linked_publishing_queue_items.includes(item.id)}
                onChange={() => toggleQueueItem(item.id)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-semibold">{item.title}</span>
                <span className="block" style={{ color: dashboardTheme.color.muted }}>{item.platform} - {item.status}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <label>
        <Label>KPIs JSON</Label>
        <textarea
          value={draft.kpis_text}
          onChange={(e) => setDraft({ ...draft, kpis_text: e.target.value })}
          rows={4}
          className="mt-1 w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Result summary</Label>
        <textarea
          value={draft.result_summary}
          onChange={(e) => setDraft({ ...draft, result_summary: e.target.value })}
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

function toPayload(draft: CampaignDraft, kpis: MarketingCampaignKpis) {
  return {
    name: draft.name,
    goal: draft.goal,
    related_arc_id: draft.related_arc_id || null,
    target_audience: draft.target_audience,
    channels: draft.channels,
    linked_publishing_queue_items: draft.linked_publishing_queue_items,
    start_date: draft.start_date || null,
    end_date: draft.end_date || null,
    status: draft.status,
    kpis,
    result_summary: draft.result_summary,
    notes: draft.notes,
  };
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
