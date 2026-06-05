'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import {
  SOCIAL_CHANNEL_PLATFORMS,
  SOCIAL_CHANNEL_PLATFORM_LABELS,
  SOCIAL_CHANNEL_STATUSES,
  SOCIAL_CHANNEL_STATUS_STYLES,
  type SocialChannel,
  type SocialChannelStatus,
} from '@/types/social-channel';

type ChannelDraft = {
  handle: string;
  profile_url: string;
  primary_format: string;
  posting_target_per_week: string;
  primary_audience: string;
  content_notes: string;
  status: SocialChannelStatus;
  connected: boolean;
  notes: string;
};

function channelToDraft(channel: SocialChannel): ChannelDraft {
  return {
    handle:                  channel.handle,
    profile_url:             channel.profile_url,
    primary_format:          channel.primary_format,
    posting_target_per_week: String(channel.posting_target_per_week),
    primary_audience:        channel.primary_audience,
    content_notes:           channel.content_notes,
    status:                  channel.status,
    connected:               channel.connected,
    notes:                   channel.notes,
  };
}

export default function SocialChannelsPage() {
  const [channels, setChannels] = useState<SocialChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/social-channels');
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      setChannels(json.channels ?? []);
    } catch {
      setError('Could not load Social Channels.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function upsertChannel(updated: SocialChannel) {
    setChannels((prev) => prev.map((ch) => ch.id === updated.id ? updated : ch));
  }

  function removeChannel(id: string) {
    setChannels((prev) => prev.filter((ch) => ch.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Marketing Studio"
        title="Social Channel Profiles"
        description="Manual profile records for each platform. No OAuth, no platform API calls, no posting, no analytics, no AI generation, and no automations."
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
          Phase 4D boundary
        </p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Channel profiles are manual metadata only. The <strong>Connected</strong> toggle records your own note — it does not authenticate with any platform, call any API, or enable any posting capability.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {SOCIAL_CHANNEL_PLATFORMS.map((platform) => (
            <div key={platform} className="h-48 animate-pulse rounded-[24px] border border-black/5 bg-white/80" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {SOCIAL_CHANNEL_PLATFORMS.map((platform) => {
            const channel = channels.find((ch) => ch.platform === platform);
            return channel ? (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onUpdated={upsertChannel}
                onDeleted={removeChannel}
              />
            ) : (
              <EmptyChannelCard key={platform} platform={platform} onCreated={(ch) => setChannels((prev) => [...prev, ch])} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  onUpdated,
  onDeleted,
}: {
  channel: SocialChannel;
  onUpdated: (channel: SocialChannel) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ChannelDraft>(() => channelToDraft(channel));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(channelToDraft(channel));
  }, [channel, editing]);

  async function save(next?: Partial<ChannelDraft>) {
    const d = { ...draft, ...next };
    setSaving(true);
    try {
      const res = await fetch(`/api/social-channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(d)),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update channel');
        return;
      }
      onUpdated(data as SocialChannel);
      setEditing(false);
      toast.success('Channel updated');
    } catch {
      toast.error('Failed to update channel');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this channel profile? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/social-channels/${channel.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(channel.id);
      toast.success('Channel deleted');
    } catch {
      toast.error('Failed to delete channel');
    } finally {
      setSaving(false);
    }
  }

  const statusStyle = SOCIAL_CHANNEL_STATUS_STYLES[channel.status];

  return (
    <article className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      {editing ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>
              {SOCIAL_CHANNEL_PLATFORM_LABELS[channel.platform]}
            </h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
              style={{ color: dashboardTheme.color.muted }}
            >
              Cancel
            </button>
          </div>
          <ChannelForm
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSubmit={() => save()}
          />
          <button
            type="button"
            onClick={remove}
            disabled={saving}
            className="mt-3 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50 disabled:opacity-50"
            style={{ color: '#B91C1C' }}
          >
            Delete channel
          </button>
        </>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
                  {SOCIAL_CHANNEL_PLATFORM_LABELS[channel.platform]}
                </h3>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{ background: statusStyle.bg, color: statusStyle.fg }}
                >
                  {statusStyle.label}
                </span>
                {channel.connected && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Connected
                  </span>
                )}
              </div>
              {channel.handle && (
                <p className="mt-0.5 text-xs font-mono" style={{ color: dashboardTheme.color.muted }}>
                  @{channel.handle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
              style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
            >
              Edit
            </button>
          </div>

          <div className="mt-3 grid gap-1.5 text-xs" style={{ color: dashboardTheme.color.text }}>
            {channel.profile_url && (
              <p><strong>URL:</strong> <span className="font-mono">{channel.profile_url}</span></p>
            )}
            {channel.primary_format && (
              <p><strong>Format:</strong> {channel.primary_format}</p>
            )}
            {channel.primary_audience && (
              <p><strong>Audience:</strong> {channel.primary_audience}</p>
            )}
            {channel.posting_target_per_week > 0 && (
              <p><strong>Target:</strong> {channel.posting_target_per_week}× per week</p>
            )}
            {channel.content_notes && (
              <p className="whitespace-pre-wrap"><strong>Content notes:</strong> {channel.content_notes}</p>
            )}
            {channel.notes && (
              <p className="whitespace-pre-wrap"><strong>Notes:</strong> {channel.notes}</p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {SOCIAL_CHANNEL_STATUSES.filter((s) => s !== channel.status).map((s) => {
              const style = SOCIAL_CHANNEL_STATUS_STYLES[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => save({ status: s })}
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

function EmptyChannelCard({
  platform,
  onCreated,
}: {
  platform: string;
  onCreated: (channel: SocialChannel) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ChannelDraft>({
    handle: '',
    profile_url: '',
    primary_format: '',
    posting_target_per_week: '0',
    primary_audience: '',
    content_notes: '',
    status: 'planned',
    connected: false,
    notes: '',
  });

  async function create() {
    setSaving(true);
    try {
      const res = await fetch('/api/social-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, ...toPayload(draft) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create channel');
        return;
      }
      onCreated(data as SocialChannel);
      toast.success('Channel created');
    } catch {
      toast.error('Failed to create channel');
    } finally {
      setSaving(false);
    }
  }

  const label = SOCIAL_CHANNEL_PLATFORM_LABELS[platform as keyof typeof SOCIAL_CHANNEL_PLATFORM_LABELS] ?? platform;

  return (
    <article className="rounded-[24px] border border-dashed border-black/10 bg-white/60 p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>{label}</h3>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg px-2 py-1 text-[11px] font-medium transition hover:bg-slate-100"
            style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}
          >
            Add
          </button>
        )}
      </div>
      {creating ? (
        <div className="mt-4">
          <ChannelForm
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </div>
      ) : (
        <p className="mt-2 text-xs" style={{ color: dashboardTheme.color.muted }}>No profile yet.</p>
      )}
    </article>
  );
}

function ChannelForm({
  draft,
  setDraft,
  saving,
  onSubmit,
  onCancel,
}: {
  draft: ChannelDraft;
  setDraft: (draft: ChannelDraft) => void;
  saving: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Handle</Label>
          <input
            value={draft.handle}
            onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
            placeholder="@username"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Status</Label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as SocialChannelStatus })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {SOCIAL_CHANNEL_STATUSES.map((s) => (
              <option key={s} value={s}>{SOCIAL_CHANNEL_STATUS_STYLES[s].label}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <Label>Profile URL</Label>
        <input
          value={draft.profile_url}
          onChange={(e) => setDraft({ ...draft, profile_url: e.target.value })}
          placeholder="https://..."
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <Label>Primary format</Label>
          <input
            value={draft.primary_format}
            onChange={(e) => setDraft({ ...draft, primary_format: e.target.value })}
            placeholder="e.g. Short-form video"
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
        <label>
          <Label>Posts per week target</Label>
          <input
            type="number"
            min={0}
            value={draft.posting_target_per_week}
            onChange={(e) => setDraft({ ...draft, posting_target_per_week: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
        </label>
      </div>

      <label>
        <Label>Primary audience</Label>
        <input
          value={draft.primary_audience}
          onChange={(e) => setDraft({ ...draft, primary_audience: e.target.value })}
          placeholder="e.g. Logan homeowners 25–55"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Content notes</Label>
        <textarea
          value={draft.content_notes}
          onChange={(e) => setDraft({ ...draft, content_notes: e.target.value })}
          rows={3}
          placeholder="What content performs well here, tone, constraints…"
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <label>
        <Label>Notes</Label>
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>

      <div className="flex items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.connected}
            onChange={(e) => setDraft({ ...draft, connected: e.target.checked })}
            className="h-4 w-4 rounded border accent-emerald-600"
          />
          <span className="text-xs font-medium" style={{ color: dashboardTheme.color.text }}>
            Connected <span className="ml-1 font-normal" style={{ color: dashboardTheme.color.muted }}>(manual note only — no platform API)</span>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50"
          style={{ background: dashboardTheme.color.primary, color: '#fff' }}
        >
          {saving ? 'Saving...' : 'Save channel'}
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

function toPayload(draft: ChannelDraft) {
  return {
    handle:                  draft.handle.trim().replace(/^@+/, ''),
    profile_url:             draft.profile_url,
    primary_format:          draft.primary_format,
    posting_target_per_week: Number(draft.posting_target_per_week) || 0,
    primary_audience:        draft.primary_audience,
    content_notes:           draft.content_notes,
    status:                  draft.status,
    connected:               draft.connected,
    notes:                   draft.notes,
  };
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>
      {children}
    </span>
  );
}
