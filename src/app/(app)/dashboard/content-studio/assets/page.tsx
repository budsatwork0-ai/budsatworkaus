'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { WorkbenchHeader, WorkbenchTabs } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import { type ContentIdea } from '@/types/content-idea';
import { type ContentScript } from '@/types/content-script';
import { type ContentProductionCard } from '@/types/content-production';
import {
  CONTENT_ASSET_CONSENT_STATUSES,
  CONTENT_ASSET_CONSENT_STYLES,
  CONTENT_ASSET_TYPES,
  type ContentAsset,
  type ContentAssetConsentStatus,
  type ContentAssetType,
} from '@/types/content-asset';

type AssetDraft = {
  title: string;
  asset_type: ContentAssetType;
  source_url: string;
  production_card_id: string;
  idea_id: string;
  script_id: string;
  consent_status: ContentAssetConsentStatus;
  related_characters: string[];
  related_customer: string;
  notes: string;
};

function emptyDraft(): AssetDraft {
  return {
    title: '',
    asset_type: 'other',
    source_url: '',
    production_card_id: '',
    idea_id: '',
    script_id: '',
    consent_status: 'unknown',
    related_characters: [],
    related_customer: '',
    notes: '',
  };
}

function assetToDraft(asset: ContentAsset): AssetDraft {
  return {
    title: asset.title,
    asset_type: asset.asset_type,
    source_url: asset.source_url,
    production_card_id: asset.production_card_id ?? '',
    idea_id: asset.idea_id ?? '',
    script_id: asset.script_id ?? '',
    consent_status: asset.consent_status,
    related_characters: asset.related_characters,
    related_customer: asset.related_customer,
    notes: asset.notes,
  };
}

export default function ContentStudioAssetsPage() {
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [cards, setCards] = useState<ContentProductionCard[]>([]);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [scripts, setScripts] = useState<ContentScript[]>([]);
  const [draft, setDraft] = useState<AssetDraft>(() => emptyDraft());
  const [activeConsent, setActiveConsent] = useState<ContentAssetConsentStatus>('unknown');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, cRes, iRes, sRes] = await Promise.all([
        fetch('/api/content-assets'),
        fetch('/api/content-production'),
        fetch('/api/content-ideas'),
        fetch('/api/content-scripts'),
      ]);
      if (!aRes.ok) throw new Error('Failed to load assets');
      const [aj, cj, ij, sj] = await Promise.all([aRes.json(), cRes.json(), iRes.json(), sRes.json()]);
      setAssets(aj.assets ?? []);
      setCards(cj.cards ?? []);
      setIdeas(ij.ideas ?? []);
      setScripts(sj.scripts ?? []);
    } catch {
      setError('Could not load Content Studio assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cardById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const ideaById = useMemo(() => new Map(ideas.map((idea) => [idea.id, idea])), [ideas]);
  const scriptById = useMemo(() => new Map(scripts.map((script) => [script.id, script])), [scripts]);

  const tabs = CONTENT_ASSET_CONSENT_STATUSES.map((status) => ({
    key: status,
    label: CONTENT_ASSET_CONSENT_STYLES[status].label,
    count: assets.filter((asset) => asset.consent_status === status).length,
  }));

  const visibleAssets = assets
    .filter((asset) => asset.consent_status === activeConsent)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  async function createAsset(payload: AssetDraft) {
    if (!payload.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (payload.consent_status === 'denied' && payload.production_card_id) {
      toast.error('Denied-consent assets cannot be linked for production use');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/content-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          production_card_id: payload.production_card_id || null,
          idea_id: payload.idea_id || null,
          script_id: payload.script_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to create asset');
        return;
      }
      setAssets((prev) => [data as ContentAsset, ...prev]);
      setDraft(emptyDraft());
      toast.success('Asset captured');
    } catch {
      toast.error('Failed to create asset');
    } finally {
      setSaving(false);
    }
  }

  function upsertAsset(updated: ContentAsset) {
    setAssets((prev) => prev.map((asset) => asset.id === updated.id ? updated : asset));
  }

  function removeAsset(id: string) {
    setAssets((prev) => prev.filter((asset) => asset.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Content Studio"
        title="Asset Library"
        description="Manual asset tracking with links and file paths only. Consent status controls production-use eligibility."
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#B45309' }}>Phase 3D boundary</p>
        <p className="mt-1.5 text-sm" style={{ color: '#92400E' }}>
          Store URLs or file paths only. Denied-consent assets cannot be linked for production use. No publishing, AI, agents, automations, or Marketing Studio integration.
        </p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>Capture asset</h2>
            <p className="mt-1 text-xs" style={{ color: dashboardTheme.color.muted }}>Add a link or path. No upload storage exists in this phase.</p>
          </div>
          <button type="button" onClick={() => setDraft(emptyDraft())} className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100" style={{ color: dashboardTheme.color.muted }}>Clear</button>
        </div>
        <AssetForm
          draft={draft}
          setDraft={setDraft}
          cards={cards}
          ideas={ideas}
          scripts={scripts}
          saving={saving}
          submitLabel="Capture asset"
          onSubmit={() => createAsset(draft)}
        />
      </section>

      <WorkbenchTabs tabs={tabs} activeTab={activeConsent} onTabChange={setActiveConsent} />

      <section className="grid gap-3">
        {loading ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>Loading assets…</p>
        ) : visibleAssets.length === 0 ? (
          <p className="rounded-2xl border border-black/5 bg-white/80 px-4 py-8 text-center text-sm" style={{ color: dashboardTheme.color.muted }}>
            No {CONTENT_ASSET_CONSENT_STYLES[activeConsent].label.toLowerCase()} assets yet.
          </p>
        ) : visibleAssets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            card={asset.production_card_id ? cardById.get(asset.production_card_id) : undefined}
            idea={asset.idea_id ? ideaById.get(asset.idea_id) : undefined}
            script={asset.script_id ? scriptById.get(asset.script_id) : undefined}
            cards={cards}
            ideas={ideas}
            scripts={scripts}
            onUpdated={upsertAsset}
            onDeleted={removeAsset}
          />
        ))}
      </section>
    </div>
  );
}

function AssetCard({
  asset,
  card,
  idea,
  script,
  cards,
  ideas,
  scripts,
  onUpdated,
  onDeleted,
}: {
  asset: ContentAsset;
  card?: ContentProductionCard;
  idea?: ContentIdea;
  script?: ContentScript;
  cards: ContentProductionCard[];
  ideas: ContentIdea[];
  scripts: ContentScript[];
  onUpdated: (asset: ContentAsset) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AssetDraft>(() => assetToDraft(asset));
  const [saving, setSaving] = useState(false);
  const consent = CONTENT_ASSET_CONSENT_STYLES[asset.consent_status];

  useEffect(() => {
    if (!editing) setDraft(assetToDraft(asset));
  }, [asset, editing]);

  async function save() {
    if (draft.consent_status === 'denied' && draft.production_card_id) {
      toast.error('Denied-consent assets cannot be linked for production use');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/content-assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          production_card_id: draft.production_card_id || null,
          idea_id: draft.idea_id || null,
          script_id: draft.script_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to update asset');
        return;
      }
      onUpdated(data as ContentAsset);
      setEditing(false);
      toast.success('Asset updated');
    } catch {
      toast.error('Failed to update asset');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this asset? This cannot be undone.')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content-assets/${asset.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(asset.id);
      toast.success('Asset deleted');
    } catch {
      toast.error('Failed to delete asset');
    } finally {
      setSaving(false);
    }
  }

  return (
    <article
      className="rounded-[24px] border bg-white/90 p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
      style={{ borderColor: consent.risky ? 'rgba(239,68,68,0.3)' : 'rgba(15,23,42,0.05)' }}
    >
      {editing ? (
        <div>
          <AssetForm
            draft={draft}
            setDraft={setDraft}
            cards={cards}
            ideas={ideas}
            scripts={scripts}
            saving={saving}
            submitLabel="Save asset"
            onSubmit={save}
            onCancel={() => setEditing(false)}
          />
          <button type="button" onClick={remove} disabled={saving} className="mt-3 rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-red-50 disabled:opacity-50" style={{ color: '#B91C1C' }}>Delete asset</button>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold" style={{ color: dashboardTheme.color.primary }}>{asset.title}</h2>
                <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: consent.bg, color: consent.fg }}>{consent.label}</span>
                <Chip>{CONTENT_ASSET_TYPES.find((type) => type.key === asset.asset_type)?.label ?? asset.asset_type}</Chip>
                {asset.consent_status === 'denied' && <span className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Not selectable for production</span>}
              </div>
              {asset.source_url && <p className="mt-1 break-all text-xs" style={{ color: dashboardTheme.color.muted }}>{asset.source_url}</p>}
            </div>
            <button type="button" onClick={() => setEditing(true)} className="rounded-xl px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100" style={{ background: '#F1F5F9', color: dashboardTheme.color.muted }}>Edit</button>
          </div>

          <div className="mt-4 grid gap-3 text-sm md:grid-cols-2" style={{ color: dashboardTheme.color.text }}>
            <Field label="Production card">{card?.title ?? (asset.consent_status === 'denied' ? 'Denied consent: unavailable' : 'Not linked')}</Field>
            <Field label="Idea">{idea?.title ?? 'Not linked'}</Field>
            <Field label="Script">{script?.id ?? 'Not linked'}</Field>
            <Field label="Related customer">{asset.related_customer || 'None'}</Field>
            <Field label="Characters">{asset.related_characters.length > 0 ? asset.related_characters.join(', ') : 'None'}</Field>
            {asset.notes && <Field label="Notes">{asset.notes}</Field>}
          </div>
        </>
      )}
    </article>
  );
}

function AssetForm({
  draft,
  setDraft,
  cards,
  ideas,
  scripts,
  saving,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  draft: AssetDraft;
  setDraft: (draft: AssetDraft) => void;
  cards: ContentProductionCard[];
  ideas: ContentIdea[];
  scripts: ContentScript[];
  saving: boolean;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
}) {
  const productionDisabled = draft.consent_status === 'denied';

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <Label>Title</Label>
          <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </label>
        <label>
          <Label>Asset type</Label>
          <select value={draft.asset_type} onChange={(e) => setDraft({ ...draft, asset_type: e.target.value as ContentAssetType })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}>
            {CONTENT_ASSET_TYPES.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
          </select>
        </label>
        <label>
          <Label>Consent status</Label>
          <select
            value={draft.consent_status}
            onChange={(e) => {
              const consent_status = e.target.value as ContentAssetConsentStatus;
              setDraft({ ...draft, consent_status, production_card_id: consent_status === 'denied' ? '' : draft.production_card_id });
            }}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          >
            {CONTENT_ASSET_CONSENT_STATUSES.map((status) => <option key={status} value={status}>{CONTENT_ASSET_CONSENT_STYLES[status].label}</option>)}
          </select>
        </label>
        <label className="md:col-span-2">
          <Label>Source URL or file path</Label>
          <input value={draft.source_url} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} placeholder="https://… or /Drive/Content/…" />
        </label>
        <label>
          <Label>Linked production card</Label>
          <select
            value={draft.production_card_id}
            disabled={productionDisabled}
            onChange={(e) => setDraft({ ...draft, production_card_id: e.target.value })}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            style={{ borderColor: dashboardTheme.color.border, color: draft.production_card_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">{productionDisabled ? 'Denied consent: unavailable' : 'No production card'}</option>
            {!productionDisabled && cards.map((card) => <option key={card.id} value={card.id}>{card.title}</option>)}
          </select>
        </label>
        <label>
          <Label>Linked idea</Label>
          <select value={draft.idea_id} onChange={(e) => setDraft({ ...draft, idea_id: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: draft.idea_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}>
            <option value="">No idea</option>
            {ideas.map((idea) => <option key={idea.id} value={idea.id}>{idea.title}</option>)}
          </select>
        </label>
        <label>
          <Label>Linked script</Label>
          <select value={draft.script_id} onChange={(e) => setDraft({ ...draft, script_id: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: draft.script_id ? dashboardTheme.color.text : dashboardTheme.color.muted }}>
            <option value="">No script</option>
            {scripts.map((script) => <option key={script.id} value={script.id}>{script.id}</option>)}
          </select>
        </label>
        <label>
          <Label>Related customer</Label>
          <input value={draft.related_customer} onChange={(e) => setDraft({ ...draft, related_customer: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
        </label>
      </div>

      <label>
        <Label>Related characters</Label>
        <input
          value={draft.related_characters.join(', ')}
          onChange={(e) => setDraft({ ...draft, related_characters: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) })}
          className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400"
          style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
        />
      </label>
      <label>
        <Label>Notes</Label>
        <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-emerald-400" style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }} />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={saving} className="rounded-xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ background: dashboardTheme.color.primary, color: '#fff' }}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-slate-100" style={{ color: dashboardTheme.color.muted }}>Cancel</button>}
      </div>
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: dashboardTheme.color.muted }}>{children}</span>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border px-2.5 py-1 text-[11px]" style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}>{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-1" style={{ color: dashboardTheme.color.muted }}>{label}</p>
      <div className="whitespace-pre-wrap text-sm leading-6" style={{ color: dashboardTheme.color.text }}>{children}</div>
    </div>
  );
}
