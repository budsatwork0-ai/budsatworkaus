'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { glass } from '@/app/ui/theme';
import type { FundraisingItem } from '@/app/api/fundraising/route';
import type { SiteImpactStats } from '@/app/api/site-impact-stats/route';
import type { SocialProofItem } from '@/app/api/social-proof/route';

type View = 'list' | 'form' | 'stats' | 'social' | 'social-form';

const STATUS_LABELS: Record<FundraisingItem['status'], string> = {
  draft: 'Draft',
  live: 'Live',
  funded: 'Funded',
  archived: 'Archived',
};

const STATUS_COLOURS: Record<FundraisingItem['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  live: 'bg-emerald-100 text-emerald-700',
  funded: 'bg-blue-100 text-blue-700',
  archived: 'bg-red-50 text-red-500',
};

function formatAUD(cents: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

const EMPTY_FORM: Omit<FundraisingItem, 'id' | 'created_at' | 'updated_at'> = {
  title: '',
  slug: '',
  category: 'equipment',
  status: 'draft',
  image_url: null,
  goal_amount_cents: 0,
  raised_amount_cents: 0,
  short_reason: '',
  who_it_helps: '',
  employment_impact: '',
  cta_label: 'Fund This',
  payment_url: '',
  sort_order: 0,
  is_featured: false,
};

const EMPTY_SOCIAL_FORM: Omit<SocialProofItem, 'id' | 'created_at' | 'updated_at'> = {
  title: '',
  platform: 'tiktok',
  source_url: '',
  thumbnail_url: '',
  posted_at: null,
  status: 'draft',
  sort_order: 0,
  is_featured: false,
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function FundraisingPage() {
  const [view, setView] = useState<View>('list');
  const [items, setItems] = useState<FundraisingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [socialItems, setSocialItems] = useState<SocialProofItem[]>([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [socialForm, setSocialForm] = useState(EMPTY_SOCIAL_FORM);
  const [stats, setStats] = useState<Omit<SiteImpactStats, 'id' | 'updated_at'>>({
    participants_supported: 0,
    paid_jobs_completed: 0,
    training_hours_delivered: 0,
    employment_opportunities_created: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadItems() {
    setLoading(true);
    try {
      // Admin needs all items — use the [id] route? No, we need a GET-all-admin route.
      // We'll reuse GET /api/fundraising but bypass RLS via service role.
      // The public GET only returns live items. For admin, we fetch via a special query.
      // Since the service client bypasses RLS for the API routes, we pass an admin flag.
      const res = await fetch('/api/fundraising/admin');
      if (res.ok) {
        const { items: data } = (await res.json()) as { items: FundraisingItem[] };
        setItems(data ?? []);
      }
    } catch {
      toast.error('Failed to load fundraising items');
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/site-impact-stats');
      if (res.ok) {
        const { stats: data } = (await res.json()) as { stats: SiteImpactStats };
        setStats({
          participants_supported: data.participants_supported ?? 0,
          paid_jobs_completed: data.paid_jobs_completed ?? 0,
          training_hours_delivered: data.training_hours_delivered ?? 0,
          employment_opportunities_created: data.employment_opportunities_created ?? 0,
        });
      }
    } catch {
      toast.error('Failed to load impact stats');
    }
  }

  async function loadSocialItems() {
    setSocialLoading(true);
    try {
      const res = await fetch('/api/social-proof/admin');
      if (res.ok) {
        const { items: data } = (await res.json()) as { items: SocialProofItem[] };
        setSocialItems(data ?? []);
      }
    } catch {
      toast.error('Failed to load social videos');
    } finally {
      setSocialLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    void loadStats();
    void loadSocialItems();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setView('form');
  }

  function openEdit(item: FundraisingItem) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      slug: item.slug,
      category: item.category,
      status: item.status,
      image_url: item.image_url,
      goal_amount_cents: item.goal_amount_cents,
      raised_amount_cents: item.raised_amount_cents,
      short_reason: item.short_reason ?? '',
      who_it_helps: item.who_it_helps ?? '',
      employment_impact: item.employment_impact ?? '',
      cta_label: item.cta_label,
      payment_url: item.payment_url ?? '',
      sort_order: item.sort_order,
      is_featured: item.is_featured,
    });
    setView('form');
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/fundraising-image', { method: 'POST', body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        setForm((prev) => ({ ...prev, image_url: data.url! }));
        toast.success('Image uploaded');
      } else {
        toast.error(data.error ?? 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        payment_url: form.payment_url || null,
        short_reason: form.short_reason || null,
        who_it_helps: form.who_it_helps || null,
        employment_impact: form.employment_impact || null,
        image_url: form.image_url || null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/fundraising/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/fundraising', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = (await res.json()) as { item?: FundraisingItem; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? 'Save failed');
        return;
      }

      toast.success(editingId ? 'Item updated' : 'Item created');
      await loadItems();
      setView('list');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    if (!confirm('Archive this item? It will no longer appear publicly.')) return;
    try {
      const res = await fetch(`/api/fundraising/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Item archived');
        await loadItems();
      } else {
        toast.error('Archive failed');
      }
    } catch {
      toast.error('Archive failed');
    }
  }

  async function handleQuickStatus(id: string, status: FundraisingItem['status']) {
    try {
      const res = await fetch(`/api/fundraising/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Marked as ${STATUS_LABELS[status]}`);
        await loadItems();
      } else {
        toast.error('Update failed');
      }
    } catch {
      toast.error('Update failed');
    }
  }

  async function handleStatsSave(e: React.FormEvent) {
    e.preventDefault();
    if (statsLoading) return;
    setStatsLoading(true);
    try {
      const res = await fetch('/api/site-impact-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stats),
      });
      if (res.ok) {
        toast.success('Impact stats updated');
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? 'Save failed');
      }
    } catch {
      toast.error('Save failed');
    } finally {
      setStatsLoading(false);
    }
  }

  function openCreateSocial() {
    setEditingSocialId(null);
    setSocialForm(EMPTY_SOCIAL_FORM);
    setView('social-form');
  }

  function openEditSocial(item: SocialProofItem) {
    setEditingSocialId(item.id);
    setSocialForm({
      title: item.title,
      platform: item.platform,
      source_url: item.source_url,
      thumbnail_url: item.thumbnail_url ?? '',
      posted_at: item.posted_at,
      status: item.status,
      sort_order: item.sort_order,
      is_featured: item.is_featured,
    });
    setView('social-form');
  }

  async function handleSocialSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        ...socialForm,
        thumbnail_url: socialForm.thumbnail_url || null,
        posted_at: socialForm.posted_at || null,
      };

      const res = editingSocialId
        ? await fetch(`/api/social-proof/${editingSocialId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/social-proof', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const data = (await res.json()) as { item?: SocialProofItem; error?: string };
      if (!res.ok || data.error) {
        toast.error(data.error ?? 'Save failed');
        return;
      }

      toast.success(editingSocialId ? 'Video updated' : 'Video created');
      await loadSocialItems();
      setView('social');
    } catch {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveSocial(id: string) {
    if (!confirm('Archive this social video? It will no longer appear publicly.')) return;
    try {
      const res = await fetch(`/api/social-proof/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Video archived');
        await loadSocialItems();
      } else {
        toast.error('Archive failed');
      }
    } catch {
      toast.error('Archive failed');
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Fundraising</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage wishlist items shown on the public{' '}
            <a href="/get-involved" target="_blank" className="underline">
              /get-involved
            </a>{' '}
            page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('stats')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Impact Stats
          </button>
          <button
            onClick={() => setView('social')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Social Videos
          </button>
          <button
            onClick={openCreate}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          >
            + New Item
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'list' && (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading...</div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No fundraising items yet.</p>
              <button
                onClick={openCreate}
                className="mt-4 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white"
              >
                Create your first item
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Progress</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => {
                  const pct =
                    item.goal_amount_cents > 0
                      ? Math.min(100, Math.round((item.raised_amount_cents / item.goal_amount_cents) * 100))
                      : 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        <p className="text-xs text-slate-400">{item.category} · /{item.slug}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLOURS[item.status]}`}
                        >
                          {STATUS_LABELS[item.status]}
                        </span>
                        {item.is_featured && (
                          <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                            Featured
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {formatAUD(item.raised_amount_cents)} / {formatAUD(item.goal_amount_cents)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{item.sort_order}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {item.status !== 'live' && (
                            <button
                              onClick={() => handleQuickStatus(item.id, 'live')}
                              className="rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                            >
                              Go Live
                            </button>
                          )}
                          {item.status === 'live' && (
                            <button
                              onClick={() => handleQuickStatus(item.id, 'funded')}
                              className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
                            >
                              Mark Funded
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(item)}
                            className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          {item.status !== 'archived' && (
                            <button
                              onClick={() => handleArchive(item.id)}
                              className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── FORM VIEW ─────────────────────────────────────────────────────────── */}
      {view === 'form' && (
        <div className={`${glass} rounded-2xl p-6`}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {editingId ? 'Edit Item' : 'New Fundraising Item'}
            </h2>
            <button
              onClick={() => setView('list')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to list
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Title + Slug */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Title *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((prev) => ({
                      ...prev,
                      title,
                      slug: prev.slug || slugify(title),
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Ride-On Mower"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Slug *
                </label>
                <input
                  required
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="ride-on-mower"
                />
              </div>
            </div>

            {/* Category + Status + Sort order */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="equipment">Equipment</option>
                  <option value="uniforms">Uniforms</option>
                  <option value="training">Training</option>
                  <option value="transport">Transport</option>
                  <option value="technology">Technology</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, status: e.target.value as FundraisingItem['status'] }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="draft">Draft</option>
                  <option value="live">Live</option>
                  <option value="funded">Funded</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sort_order: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Goal + Raised */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Goal Amount (AUD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={form.goal_amount_cents / 100}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        goal_amount_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="1800"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Amount Raised (AUD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    value={form.raised_amount_cents / 100}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        raised_amount_cents: Math.round(parseFloat(e.target.value || '0') * 100),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 py-2 pl-7 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Short reason */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Short Reason
              </label>
              <textarea
                rows={2}
                value={form.short_reason ?? ''}
                onChange={(e) => setForm((prev) => ({ ...prev, short_reason: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="Why do you need this item?"
              />
            </div>

            {/* Who it helps + Employment impact */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Who It Helps
                </label>
                <textarea
                  rows={2}
                  value={form.who_it_helps ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, who_it_helps: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Silvan and future participants"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Employment Impact
                </label>
                <textarea
                  rows={2}
                  value={form.employment_impact ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, employment_impact: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Creates additional paid shifts"
                />
              </div>
            </div>

            {/* CTA label + Payment URL */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  CTA Button Label
                </label>
                <input
                  value={form.cta_label}
                  onChange={(e) => setForm((prev) => ({ ...prev, cta_label: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Fund This"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Payment URL (optional — Stripe link)
                </label>
                <input
                  type="url"
                  value={form.payment_url ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_url: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="https://buy.stripe.com/..."
                />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Item Image
              </label>
              {form.image_url && (
                <div className="mb-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="h-20 w-32 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, image_url: null }))}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadImage}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {uploading ? 'Uploading…' : 'Upload Image'}
                </button>
                <span className="text-xs text-slate-400">Max 5MB · JPG, PNG, WebP</span>
              </div>
            </div>

            {/* Featured flag */}
            <div className="flex items-center gap-3">
              <input
                id="is_featured"
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((prev) => ({ ...prev, is_featured: e.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="is_featured" className="text-sm text-slate-700">
                Feature this item (shown first on the public page)
              </label>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setView('list')}
                className="text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── STATS VIEW ────────────────────────────────────────────────────────── */}
      {view === 'stats' && (
        <div className={`${glass} rounded-2xl p-6`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Impact Stats</h2>
              <p className="mt-1 text-sm text-slate-500">
                These numbers appear publicly on the /get-involved page. Keep them honest.
              </p>
            </div>
            <button
              onClick={() => setView('list')}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to list
            </button>
          </div>

          <form onSubmit={handleStatsSave} className="space-y-4">
            {(
              [
                { key: 'participants_supported', label: 'Participants Supported' },
                { key: 'paid_jobs_completed', label: 'Paid Jobs Completed' },
                { key: 'training_hours_delivered', label: 'Training Hours Delivered' },
                {
                  key: 'employment_opportunities_created',
                  label: 'Employment Opportunities Created',
                },
              ] as const
            ).map(({ key, label }) => (
              <div key={key} className="grid items-center gap-4 sm:grid-cols-[220px_1fr]">
                <label className="text-sm font-medium text-slate-700">{label}</label>
                <input
                  type="number"
                  min="0"
                  value={stats[key]}
                  onChange={(e) =>
                    setStats((prev) => ({ ...prev, [key]: parseInt(e.target.value, 10) || 0 }))
                  }
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            ))}

            <div className="flex justify-end border-t border-slate-100 pt-4">
              <button
                type="submit"
                disabled={statsLoading}
                className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {statsLoading ? 'Saving…' : 'Save Stats'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── SOCIAL VIDEO LIST ───────────────────────────────────────────────── */}
      {view === 'social' && (
        <div className={`${glass} rounded-2xl overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Social Videos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Feature real Buds At Work TikTok, Instagram and Facebook videos on /get-involved.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('list')} className="text-sm text-slate-500 hover:text-slate-700">
                Back to items
              </button>
              <button onClick={openCreateSocial} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                + New Video
              </button>
            </div>
          </div>
          {socialLoading ? (
            <div className="p-12 text-center text-sm text-slate-400">Loading...</div>
          ) : socialItems.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No social videos yet.</p>
              <button onClick={openCreateSocial} className="mt-4 rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white">
                Add the first video
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Video</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Order</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {socialItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 underline">
                        {item.source_url}
                      </a>
                    </td>
                    <td className="px-5 py-3 capitalize text-slate-600">{item.platform}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        item.status === 'live' ? 'bg-emerald-100 text-emerald-700' : item.status === 'archived' ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                      {item.is_featured && (
                        <span className="ml-1.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                          Featured
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{item.sort_order}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditSocial(item)} className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
                          Edit
                        </button>
                        {item.status !== 'archived' && (
                          <button onClick={() => handleArchiveSocial(item.id)} className="rounded px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
                            Archive
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── SOCIAL VIDEO FORM ───────────────────────────────────────────────── */}
      {view === 'social-form' && (
        <div className={`${glass} rounded-2xl p-6`}>
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {editingSocialId ? 'Edit Social Video' : 'New Social Video'}
            </h2>
            <button onClick={() => setView('social')} className="text-sm text-slate-500 hover:text-slate-700">
              Back to videos
            </button>
          </div>

          <form onSubmit={handleSocialSave} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Title *</label>
                <input
                  required
                  value={socialForm.title}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Window cleaning shift update"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Platform</label>
                <select
                  value={socialForm.platform}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, platform: e.target.value as SocialProofItem['platform'] }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Video URL *</label>
              <input
                required
                type="url"
                value={socialForm.source_url}
                onChange={(e) => setSocialForm((prev) => ({ ...prev, source_url: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                placeholder="https://www.tiktok.com/@buds.at.work/video/..."
              />
              <p className="mt-1 text-xs text-slate-400">Use Buds At Work TikTok, Instagram or Facebook links only.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Thumbnail URL</label>
                <input
                  type="url"
                  value={socialForm.thumbnail_url ?? ''}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, thumbnail_url: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Posted Date</label>
                <input
                  type="date"
                  value={socialForm.posted_at ?? ''}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, posted_at: e.target.value || null }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort Order</label>
                <input
                  type="number"
                  value={socialForm.sort_order}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, sort_order: parseInt(e.target.value, 10) || 0 }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                <select
                  value={socialForm.status}
                  onChange={(e) => setSocialForm((prev) => ({ ...prev, status: e.target.value as SocialProofItem['status'] }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="draft">Draft</option>
                  <option value="live">Live</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={socialForm.is_featured}
                    onChange={(e) => setSocialForm((prev) => ({ ...prev, is_featured: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Feature this video
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setView('social')} className="text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                {saving ? 'Saving...' : editingSocialId ? 'Save Changes' : 'Create Video'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
