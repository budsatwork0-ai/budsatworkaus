'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { brand } from '@/app/ui/theme';
import { type ContentLibraryItemWithMemory } from '@/types/content-library';

type Props = {
  initialItems: ContentLibraryItemWithMemory[];
};

// ── Derived filter types ───────────────────────────────────────────────────────
type FilterKey = 'all' | string;

function deriveFilters(items: ContentLibraryItemWithMemory[]) {
  const types = new Set<string>();
  const statuses = new Set<string>();
  const platforms = new Set<string>();

  for (const item of items) {
    if (item.item_type) types.add(item.item_type);
    if (item.status) statuses.add(item.status);
    if (item.platform) platforms.add(item.platform);
  }

  return {
    types: ['all', ...Array.from(types).sort()],
    statuses: ['all', ...Array.from(statuses).sort()],
    platforms: ['all', ...Array.from(platforms).sort()],
  };
}

// ── Filter chip ───────────────────────────────────────────────────────────────
function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition"
      style={
        active
          ? { background: brand.accent, color: '#fff' }
          : { background: '#F1F5F9', color: '#64748B' }
      }
    >
      {label === 'all' ? 'All' : label}
    </button>
  );
}

// ── Library card ───────────────────────────────────────────────────────────────
function LibraryCard({ item }: { item: ContentLibraryItemWithMemory }) {
  const learningCount = item.learning_records.length;
  const sourceLabel = item.source_table?.replace(/_/g, ' ') ?? 'unknown';

  return (
    <div className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      {/* Top row — badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          {item.item_type}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {item.status}
        </span>
        {item.platform && (
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            {item.platform}
          </span>
        )}
      </div>

      {/* Title + summary */}
      <h2 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h2>
      {item.summary && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500">{item.summary}</p>
      )}

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
        <span>Source: {sourceLabel}</span>
        <span>{learningCount} learning{learningCount !== 1 ? 's' : ''}</span>
        <span>Updated {formatDate(item.updated_at)}</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/content?reuse=${item.id}`}
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
        >
          Reuse format
        </Link>
        <Link
          href={`/dashboard/content/learn?item_id=${item.id}`}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold transition hover:opacity-80"
          style={{ background: '#EFF6FF', color: brand.accent }}
        >
          Add learning
        </Link>
        {item.artifact_id && (
          <Link
            href={`/dashboard/content/artifacts/${item.artifact_id}`}
            className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            View artifact
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export function ContentLibraryClient({ initialItems }: Props) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterKey>('all');
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [platformFilter, setPlatformFilter] = useState<FilterKey>('all');

  const { types, statuses, platforms } = useMemo(
    () => deriveFilters(initialItems),
    [initialItems],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (platformFilter !== 'all' && item.platform !== platformFilter) return false;
      if (!needle) return true;
      return [
        item.title,
        item.summary,
        item.item_type,
        item.status,
        item.platform ?? '',
        item.searchable_text,
        ...item.tags,
      ].join(' ').toLowerCase().includes(needle);
    });
  }, [initialItems, query, typeFilter, statusFilter, platformFilter]);

  return (
    <div className="flex flex-col gap-5">
      {/* Search bar */}
      <div className="rounded-[24px] border border-black/5 bg-white/90 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search title, summary, tags..."
          className="w-full rounded-xl border border-black/10 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Filter chip rows */}
      <div className="flex flex-col gap-3">
        {/* Type */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Type
          </span>
          {types.map((t) => (
            <FilterChip
              key={t}
              label={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
            />
          ))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Status
          </span>
          {statuses.map((s) => (
            <FilterChip
              key={s}
              label={s}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
        </div>

        {/* Platform — only show if more than just "all" */}
        {platforms.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              Platform
            </span>
            {platforms.map((p) => (
              <FilterChip
                key={p}
                label={p}
                active={platformFilter === p}
                onClick={() => setPlatformFilter(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white/80 p-8 text-center">
          <p className="text-sm text-slate-500">No library items match this search.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((item) => (
            <LibraryCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
