'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { type ContentLibraryItemWithMemory } from '@/types/content-library';

type Props = {
  initialItems: ContentLibraryItemWithMemory[];
};

const ITEM_TYPES = ['all', 'artifact', 'asset', 'campaign', 'published'] as const;

export function ContentLibraryClient({ initialItems }: Props) {
  const [query, setQuery] = useState('');
  const [itemType, setItemType] = useState<(typeof ITEM_TYPES)[number]>('all');
  const [status, setStatus] = useState('all');

  const statuses = useMemo(() => {
    return ['all', ...Array.from(new Set(initialItems.map((item) => item.status))).sort()];
  }, [initialItems]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (itemType !== 'all' && item.item_type !== itemType) return false;
      if (status !== 'all' && item.status !== status) return false;
      if (!needle) return true;

      return [
        item.title,
        item.summary,
        item.item_type,
        item.status,
        item.platform ?? '',
        item.searchable_text,
        ...item.tags,
        ...item.campaign_history.map((history) => `${history.run_title} ${history.goal} ${history.status}`),
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [initialItems, itemType, query, status]);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search artifacts, campaigns, goals, tags, signals"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Type</span>
            <select
              value={itemType}
              onChange={(event) => setItemType(event.target.value as (typeof ITEM_TYPES)[number])}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
            >
              {ITEM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600"
            >
              {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="grid gap-3">
        {filtered.length > 0 ? filtered.map((item) => (
          <LibraryCard key={item.id} item={item} />
        )) : (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
            No library records match this search.
          </div>
        )}
      </section>
    </div>
  );
}

function LibraryCard({ item }: { item: ContentLibraryItemWithMemory }) {
  const href = item.artifact_id ? `/dashboard/content/artifacts/${item.artifact_id}` : null;
  const performanceEntries = Object.entries(item.performance ?? {}).slice(0, 4);

  const content = (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition hover:bg-slate-50">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{item.item_type}</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{item.status}</span>
            {item.platform ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{item.platform}</span> : null}
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.summary || 'No summary recorded.'}</p>
        </div>

        <div className="grid min-w-[180px] gap-2 text-right text-xs text-slate-500">
          <span>Updated {formatDate(item.updated_at)}</span>
          {item.version_visibility ? (
            <span>
              v{item.version_visibility.latest_version_number ?? 0} · {item.version_visibility.version_count} version{item.version_visibility.version_count === 1 ? '' : 's'}
            </span>
          ) : (
            <span>No version record</span>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <InfoPanel title="Campaign History">
          {item.campaign_history.length > 0 ? item.campaign_history.slice(0, 3).map((history) => (
            <p key={`${history.run_id}-${history.role}`} className="text-sm leading-5 text-slate-600">
              {history.goal} · {history.status} · {history.role}
            </p>
          )) : (
            <p className="text-sm text-slate-500">No campaign run linked yet.</p>
          )}
        </InfoPanel>

        <InfoPanel title="Performance Metadata">
          {performanceEntries.length > 0 ? performanceEntries.map(([key, value]) => (
            <p key={key} className="text-sm leading-5 text-slate-600">{key}: {String(value)}</p>
          )) : (
            <p className="text-sm text-slate-500">No performance metadata recorded.</p>
          )}
        </InfoPanel>

        <InfoPanel title="Organisational Memory">
          <div className="flex flex-wrap gap-2">
            {item.tags.length > 0 ? item.tags.slice(0, 8).map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{tag}</span>
            )) : (
              <p className="text-sm text-slate-500">No memory tags recorded.</p>
            )}
          </div>
        </InfoPanel>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
