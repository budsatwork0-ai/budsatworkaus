'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkbenchHeader } from '../../components/Workbench';
import { dashboardTheme } from '@/lib/design-system/themes';
import { CONTENT_POTENTIAL_STYLES, CONTENT_POTENTIAL_LABELS } from '@/types/journal';
import type { ContentPotentialRating } from '@/types/journal';

type EntryListItem = {
  id: string;
  entry_date: string;
  wins: string | null;
  challenges: string | null;
  tags: string[];
  content_potential_rating: ContentPotentialRating;
  story_opportunity_created: boolean;
  created_at: string;
};

const ALL_RATINGS: ContentPotentialRating[] = ['none', 'low', 'medium', 'high'];

export default function JournalListPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<EntryListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [rating, setRating] = useState('');
  const [tag, setTag] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (rating) params.set('rating', rating);
    if (tag) params.set('tag', tag);
    if (from) params.set('from', from);
    if (to) params.set('to', to);

    try {
      const res = await fetch(`/api/journal?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load entries');
      const json = await res.json();
      setEntries(json.entries ?? []);
      setTotal(json.total ?? 0);
    } catch {
      setError('Could not load journal entries.');
    } finally {
      setLoading(false);
    }
  }, [search, rating, tag, from, to]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const allTags = Array.from(new Set(entries.flatMap((e) => e.tags))).sort();

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  function preview(text: string | null) {
    if (!text?.trim()) return null;
    return text.trim().slice(0, 120) + (text.trim().length > 120 ? '…' : '');
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Story Engine"
        title="Founder Journal"
        description="The daily capture layer. Write here. The Story Engine reads from here."
        actions={
          <Link
            href="/dashboard/story-engine/journal/new"
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            style={{ background: dashboardTheme.color.primary }}
          >
            + New Entry
          </Link>
        }
      />

      {/* Filters */}
      <div className="rounded-[20px] border border-black/5 bg-white/90 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entries…"
            className="col-span-full rounded-xl border px-3 py-2 text-sm sm:col-span-2 lg:col-span-2"
            style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
          />
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: rating ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">All ratings</option>
            {ALL_RATINGS.map((r) => (
              <option key={r} value={r}>{CONTENT_POTENTIAL_LABELS[r]}</option>
            ))}
          </select>
          <select
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
            style={{ borderColor: dashboardTheme.color.border, color: tag ? dashboardTheme.color.text : dashboardTheme.color.muted }}
          >
            <option value="">All tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              title="From date"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: dashboardTheme.color.border, color: dashboardTheme.color.text }}
              title="To date"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>
          {loading ? 'Loading…' : `${total} ${total === 1 ? 'entry' : 'entries'}`}
        </p>
        {(search || rating || tag || from || to) && (
          <button
            type="button"
            onClick={() => { setSearch(''); setRating(''); setTag(''); setFrom(''); setTo(''); }}
            className="text-xs font-medium underline"
            style={{ color: dashboardTheme.color.muted }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C' }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <div className="rounded-[24px] border border-black/5 bg-white/90 px-6 py-16 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
          <p className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
            {search || rating || tag || from || to ? 'No entries match this filter.' : 'No entries yet.'}
          </p>
          <p className="mt-2 text-sm" style={{ color: dashboardTheme.color.muted }}>
            {search || rating || tag ? 'Try a broader search.' : 'Start writing — your first entry becomes the foundation of the Story Engine.'}
          </p>
          {!search && !rating && !tag && (
            <Link
              href="/dashboard/story-engine/journal/new"
              className="mt-4 inline-flex rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ background: dashboardTheme.color.primary }}
            >
              Write today's entry
            </Link>
          )}
        </div>
      )}

      {/* Entry list */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => {
            const ratingStyle = CONTENT_POTENTIAL_STYLES[entry.content_potential_rating];
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => router.push(`/dashboard/story-engine/journal/${entry.id}`)}
                className="rounded-[24px] border border-black/5 bg-white/90 p-5 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(15,61,46,0.08)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold" style={{ color: dashboardTheme.color.primary }}>
                      {formatDate(entry.entry_date)}
                    </p>
                    {preview(entry.wins) && (
                      <p className="mt-1.5 text-sm leading-6" style={{ color: dashboardTheme.color.text }}>
                        {preview(entry.wins)}
                      </p>
                    )}
                    {!preview(entry.wins) && preview(entry.challenges) && (
                      <p className="mt-1.5 text-sm leading-6 italic" style={{ color: dashboardTheme.color.muted }}>
                        {preview(entry.challenges)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: ratingStyle.bg, color: ratingStyle.fg }}
                    >
                      {CONTENT_POTENTIAL_LABELS[entry.content_potential_rating]}
                    </span>
                    {entry.story_opportunity_created && (
                      <span
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                        style={{ background: '#ECFDF5', color: '#047857' }}
                      >
                        Story opportunity created
                      </span>
                    )}
                  </div>
                </div>
                {entry.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {entry.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full border px-2.5 py-1 text-[11px]"
                        style={{ borderColor: 'rgba(15,61,46,0.12)', color: dashboardTheme.color.muted }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
