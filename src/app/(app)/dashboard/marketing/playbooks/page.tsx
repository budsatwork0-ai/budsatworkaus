'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  DISTRIBUTION_PLAYBOOK_PLATFORMS,
  DISTRIBUTION_PLAYBOOK_STATUSES,
  DISTRIBUTION_PLAYBOOK_STATUS_STYLES,
  type DistributionPlaybook,
  type DistributionPlaybookStatus,
} from '@/types/distribution-playbook';
import { type MarketingCampaignWithQueueItems } from '@/types/marketing-campaign';

type PlaybookDraft = {
  title: string;
  description: string;
  content_type: string;
  primary_platform: string;
  secondary_platforms: string[];
  steps: string;
  checklist: string;
  linked_campaign_id: string;
  status: DistributionPlaybookStatus;
  notes: string;
};

const STATUS_ORDER = DISTRIBUTION_PLAYBOOK_STATUSES;

function emptyDraft(): PlaybookDraft {
  return {
    title: '',
    description: '',
    content_type: '',
    primary_platform: '',
    secondary_platforms: [],
    steps: '',
    checklist: '',
    linked_campaign_id: '',
    status: 'draft',
    notes: '',
  };
}

function playbookToDraft(playbook: DistributionPlaybook): PlaybookDraft {
  return {
    title: playbook.title,
    description: playbook.description,
    content_type: playbook.content_type,
    primary_platform: playbook.primary_platform,
    secondary_platforms: playbook.secondary_platforms,
    steps: playbook.steps.join('\n'),
    checklist: playbook.checklist.join('\n'),
    linked_campaign_id: playbook.linked_campaign_id ?? '',
    status: playbook.status,
    notes: playbook.notes,
  };
}

function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

export default function DistributionPlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<DistributionPlaybook[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaignWithQueueItems[]>([]);
  const [draft, setDraft] = useState<PlaybookDraft>(() => emptyDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [pRes, cRes] = await Promise.all([
        fetch('/api/distribution-playbooks'),
        fetch('/api/marketing-campaigns'),
      ]);
      if (!pRes.ok || !cRes.ok) throw new Error('Failed to load distribution playbooks');
      const [pj, cj] = await Promise.all([pRes.json(), cRes.json()]);
      setPlaybooks(pj.playbooks ?? []);
      setCampaigns(cj.campaigns ?? []);
    } catch {
      setError('Could not load Distribution Playbooks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const campaignById = useMemo(() => new Map(campaigns.map((campaign) => [campaign.id, campaign])), [campaigns]);

  async function createPlaybook() {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/distribution-playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(draft)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create playbook');
        return;
      }
      setPlaybooks((prev) => [data as DistributionPlaybook, ...prev]);
      setDraft(emptyDraft());
      toast.success('Playbook created');
    } catch {
      toast.error('Failed to create playbook');
    } finally {
      setSaving(false);
    }
  }

  function upsertPlaybook(updated: DistributionPlaybook) {
    setPlaybooks((prev) => prev.map((playbook) => playbook.id === updated.id ? updated : playbook));
  }

  function removePlaybook(id: string) {
    setPlaybooks((prev) => prev.filter((playbook) => playbook.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Marketing Studio"
        title="Distribution Playbooks"
        description="Manual instruction sets for distributing content consistently. These are checklists only: no social posting, platform APIs, AI generation, agents, or automations."
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
          Phase 4C boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Playbooks are manual steps and checklist items. They can link to a campaign for context, but they do not publish, schedule, generate, or automate anything.
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
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Create playbook</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>
              Write manual steps and checklist items for a repeatable distribution pattern.
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
        <PlaybookForm
          draft={draft}
          setDraft={setDraft}
          campaigns={campaigns}
          saving={saving}
          submitLabel="Create playbook"
          onSubmit={createPlaybook}
        />
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        {STATUS_ORDER.map((status) => {
          const style = DISTRIBUTION_PLAYBOOK_STATUS_STYLES[status];
          const items = playbooks
            .filter((playbook) => playbook.status === status)
            .sort((a, b) => a.title.localeCompare(b.title));
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
                    No playbooks
                  </p>
                ) : items.map((playbook) => (
                  <PlaybookCard
                    key={playbook.id}
                    playbook={playbook}
                    campaign={playbook.linked_campaign_id ? campaignById.get(playbook.linked_campaign_id) : undefined}
                    campaigns={campaigns}
                    onUpdated={upsertPlaybook}
                    onDeleted={removePlaybook}
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

function PlaybookCard({
  playbook,
  campaign,
  campaigns,
  onUpdated,
  onDeleted,
}: {
  playbook: DistributionPlaybook;
  campaign?: MarketingCampaignWithQueueItems;
  campaigns: MarketingCampaignWithQueueItems[];
  onUpdated: (playbook: DistributionPlaybook) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlaybookDraft>(() => playbookToDraft(playbook));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(playbookToDraft(playbook));
  }, [playbook, editing]);

  async function save(next?: Partial<PlaybookDraft>) {
    const payloadDraft = { ...draft, ...next };
    setSaving(true);
    try {
      const res = await fetch(`/api/distribution-playbooks/${playbook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(payloadDraft)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update playbook');
        return;
      }
      onUpdated(data as DistributionPlaybook);
      setEditing(false);
      toast.success('Playbook updated');
    } catch {
      toast.error('Failed to update playbook');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this distribution playbook? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/distribution-playbooks/${playbook.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(playbook.id);
      toast.success('Playbook deleted');
    } catch {
      toast.error('Failed to delete playbook');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-black/5 bg-white p-4">
      {editing ? (
        <div>
          <PlaybookForm
            draft={draft}
            setDraft={setDraft}
            campaigns={campaigns}
            saving={saving}
            submitLabel="Save playbook"
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
            Delete playbook
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{playbook.title}</h3>
              <p className="mt-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
                {playbook.content_type || 'No content type'} - {playbook.primary_platform || 'No platform'}
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
            <p>{playbook.description || 'No description'}</p>
            <p><strong>Campaign:</strong> {campaign?.name ?? 'No linked campaign'}</p>
            {playbook.notes && <p className="whitespace-pre-wrap"><strong>Notes:</strong> {playbook.notes}</p>}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {playbook.secondary_platforms.map((platform) => <Chip key={platform}>{platform}</Chip>)}
          </div>

          {playbook.steps.length > 0 && (
            <ListBlock title="Steps" items={playbook.steps} />
          )}
          {playbook.checklist.length > 0 && (
            <ListBlock title="Checklist" items={playbook.checklist} />
          )}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {STATUS_ORDER.filter((status) => status !== playbook.status).map((status) => {
              const style = DISTRIBUTION_PLAYBOOK_STATUS_STYLES[status];
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

function PlaybookForm({
  draft,
  setDraft,
  campaigns,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: PlaybookDraft;
  setDraft: (draft: PlaybookDraft) => void;
  campaigns: MarketingCampaignWithQueueItems[];
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  function toggleSecondaryPlatform(platform: string) {
    setDraft({
      ...draft,
      secondary_platforms: draft.secondary_platforms.includes(platform)
        ? draft.secondary_platforms.filter((item) => item !== platform)
        : [...draft.secondary_platforms, platform],
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
          <Label>Title</Label>
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as DistributionPlaybookStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>{DISTRIBUTION_PLAYBOOK_STATUS_STYLES[status].label}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Description</Label>
        <textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label>
          <Label>Content type</Label>
          <input
            value={draft.content_type}
            onChange={(e) => setDraft({ ...draft, content_type: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Primary platform</Label>
          <select
            value={draft.primary_platform}
            onChange={(e) => setDraft({ ...draft, primary_platform: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.primary_platform ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">No platform</option>
            {DISTRIBUTION_PLAYBOOK_PLATFORMS.map((platform) => <option key={platform} value={platform}>{platform}</option>)}
          </select>
        </label>
        <label>
          <Label>Linked campaign</Label>
          <select
            value={draft.linked_campaign_id}
            onChange={(e) => setDraft({ ...draft, linked_campaign_id: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.linked_campaign_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">No campaign</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </label>
      </div>

      <div>
        <Label>Secondary platforms</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {DISTRIBUTION_PLAYBOOK_PLATFORMS.map((platform) => (
            <button
              key={platform}
              type="button"
              onClick={() => toggleSecondaryPlatform(platform)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
              style={{
                borderColor: draft.secondary_platforms.includes(platform) ? '#047857' : 'rgba(15,61,46,0.12)',
                background: draft.secondary_platforms.includes(platform) ? '#ECFDF5' : '#fff',
                color: draft.secondary_platforms.includes(platform) ? '#047857' : dashboardTheme.color.muted,
              }}
            >
              {platform}
            </button>
          ))}
        </div>
      </div>

      <label>
        <Label>Steps</Label>
        <textarea
          value={draft.steps}
          onChange={(e) => setDraft({ ...draft, steps: e.target.value })}
          rows={5}
          placeholder="One step per line"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Checklist</Label>
        <textarea
          value={draft.checklist}
          onChange={(e) => setDraft({ ...draft, checklist: e.target.value })}
          rows={5}
          placeholder="One item per line"
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

function toPayload(draft: PlaybookDraft) {
  return {
    title: draft.title,
    description: draft.description,
    content_type: draft.content_type,
    primary_platform: draft.primary_platform,
    secondary_platforms: draft.secondary_platforms,
    steps: splitLines(draft.steps),
    checklist: splitLines(draft.checklist),
    linked_campaign_id: draft.linked_campaign_id || null,
    status: draft.status,
    notes: draft.notes,
  };
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-semibold" style={{ color: dashboardTheme.color.primary }}>{title}</p>
      <ol className="mt-1 grid list-decimal list-inside gap-1 text-[11px]" style={{ color: dashboardTheme.color.muted }}>
        {items.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
      </ol>
    </div>
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
