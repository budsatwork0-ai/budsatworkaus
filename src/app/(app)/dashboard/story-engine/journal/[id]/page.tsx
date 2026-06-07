'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { WorkbenchHeader } from '../../../components/Workbench';
import JournalEntryForm from '../_components/JournalEntryForm';
import SuggestionsApplyPanel from '../_components/SuggestionsApplyPanel';
import { dashboardTheme } from '@/lib/design-system/themes';
import type { JournalEntry } from '@/types/journal';

export default function JournalEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/journal/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((data) => setEntry(data))
      .catch(() => setError('Entry not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <WorkbenchHeader
        eyebrow="Founder Journal"
        title={entry ? formatDate(entry.entry_date) : loading ? 'Loading…' : 'Entry'}
        description="Edit this entry. Changes are saved when you click Save changes."
        actions={
          <Link
            href="/dashboard/story-engine/journal"
            className="rounded-xl px-4 py-2 text-sm font-medium"
            style={{ background: '#F1F5F9', color: '#64748B' }}
          >
            ← All entries
          </Link>
        }
      />

      {loading && (
        <div className="rounded-[20px] border border-black/5 bg-white/90 p-8 text-center">
          <p className="text-sm" style={{ color: dashboardTheme.color.muted }}>Loading entry…</p>
        </div>
      )}

      {error && (
        <div className="rounded-[20px] border px-5 py-4 text-sm" style={{ background: '#FEF2F2', color: '#B91C1C', borderColor: 'rgba(239,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {entry && <JournalEntryForm mode="edit" initial={entry} />}
      {entry && <SuggestionsApplyPanel entry={entry} />}
    </div>
  );
}
